import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  type INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AI_RATE_LIMIT_STORE,
  createAiRateLimitStoreProvider,
} from '../../ai/guards/ai-throttler.guard';
import type { RateLimitStore } from '../../common/rate-limit/fixed-window-rate-limit';
import { DRIZZLE } from '../../database/database.constants';
import type { EventAiDraftResponseDto } from '../dto/event-ai-draft-response.dto';
import { COMPLETE_DRAFT } from './__fixtures__/event-ai-draft.fixtures';
import { EventAiDraftController } from './event-ai-draft.controller';
import { EventAiDraftService } from './event-ai-draft.service';

const RATE_LIMIT_MAX = 3;

const generate =
  jest.fn<(dto: { prompt: string }) => Promise<EventAiDraftResponseDto>>();
const insert = jest.fn();

let isOrganizer = false;

const fakeDrizzle = {
  insert,
  select: () => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          orderBy: async () =>
            isOrganizer
              ? [
                  {
                    orgId: 'org-1',
                    organizationName: 'Hubee',
                    role: 'member',
                    permission: 'full',
                    inviteStatus: 'accepted',
                  },
                ]
              : [],
        }),
      }),
    }),
  }),
};

describe('POST /events/ai-draft', () => {
  let app: INestApplication;
  let store: RateLimitStore;
  let userToken: string;
  let adminToken: string;

  const post = (body: unknown, token = userToken) =>
    request(app.getHttpServer())
      .post('/events/ai-draft')
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [EventAiDraftController],
      providers: [
        { provide: EventAiDraftService, useValue: { generate } },
        { provide: DRIZZLE, useValue: fakeDrizzle },
        createAiRateLimitStoreProvider(),
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                AI_RATE_LIMIT_MAX: RATE_LIMIT_MAX,
                AI_RATE_LIMIT_WINDOW_MS: 60_000,
              })[key],
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    store = module.get(AI_RATE_LIMIT_STORE);
    const jwt = module.get(JwtService);
    userToken = await jwt.signAsync({
      sub: 'user-id',
      email: 'user@example.com',
      role: 'USER',
    });
    adminToken = await jwt.signAsync({
      sub: 'admin-id',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    store.clear();
    isOrganizer = true;
    generate.mockReset();
    generate.mockResolvedValue(
      COMPLETE_DRAFT.response as EventAiDraftResponseDto,
    );
    insert.mockReset();
  });

  it('responde 200 com o rascunho para um organizador', async () => {
    const response = await post({ prompt: COMPLETE_DRAFT.description }).expect(
      200,
    );

    expect(response.body).toEqual(COMPLETE_DRAFT.response);
    expect(generate).toHaveBeenCalledWith({
      prompt: COMPLETE_DRAFT.description,
    });
  });

  it('remove os espaços nas pontas da descrição', async () => {
    await post({ prompt: '   Show de rock no sábado   ' }).expect(200);

    expect(generate).toHaveBeenCalledWith({ prompt: 'Show de rock no sábado' });
  });

  it('responde 200 para ADMIN sem organização', async () => {
    isOrganizer = false;

    await post({ prompt: 'Show de rock' }, adminToken).expect(200);
  });

  it('não cria nem publica evento', async () => {
    await post({ prompt: 'Show de rock' }).expect(200);

    expect(insert).not.toHaveBeenCalled();
  });

  it('responde 401 sem token', async () => {
    await request(app.getHttpServer())
      .post('/events/ai-draft')
      .send({ prompt: 'Show de rock' })
      .expect(401);
  });

  it('responde 403 para comprador sem organização, sem gastar a cota', async () => {
    isOrganizer = false;

    const response = await post({ prompt: 'Show de rock' }).expect(403);

    expect(response.body.message).toBe(
      'Acesso restrito a organizadores de eventos',
    );
    expect(generate).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it.each([
    ['sem prompt', {}, 'Descreva o evento para gerar o rascunho.'],
    [
      'com prompt vazio',
      { prompt: '' },
      'Descreva o evento para gerar o rascunho.',
    ],
    [
      'com prompt só de espaços',
      { prompt: '   ' },
      'Descreva o evento para gerar o rascunho.',
    ],
    [
      'com prompt que não é texto',
      { prompt: 123 },
      'A descrição do evento deve ser um texto.',
    ],
    [
      'com prompt acima de 2000 caracteres',
      { prompt: 'a'.repeat(2001) },
      'A descrição do evento deve ter no máximo 2000 caracteres.',
    ],
    [
      'com campo extra',
      { prompt: 'Show de rock', organizerId: 'org-1' },
      'property organizerId should not exist',
    ],
  ])('responde 400 %s', async (_case, body, message) => {
    const response = await post(body).expect(400);

    expect(response.body.message).toContain(message);
    expect(generate).not.toHaveBeenCalled();
  });

  it('aceita prompt com exatamente 2000 caracteres', async () => {
    await post({ prompt: 'a'.repeat(2000) }).expect(200);
  });

  it('responde 429 em pt-BR com Retry-After quando o organizador estoura o limite', async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await post({ prompt: 'Show de rock' }).expect(200);
    }

    const response = await post({ prompt: 'Show de rock' }).expect(429);

    expect(response.body.message).toMatch(
      /^Você atingiu o limite de gerações com IA\. Tente novamente em \d+ segundos\.$/,
    );
    expect(response.headers['retry-after']).toBeDefined();
    expect(generate).toHaveBeenCalledTimes(RATE_LIMIT_MAX);
  });

  it('repassa o 503 do serviço de IA', async () => {
    generate.mockRejectedValue(
      new ServiceUnavailableException(
        'A geração com IA não está disponível no momento. Tente novamente em instantes.',
      ),
    );

    const response = await post({ prompt: 'Show de rock' }).expect(503);

    expect(response.body.message).toBe(
      'A geração com IA não está disponível no momento. Tente novamente em instantes.',
    );
  });
});
