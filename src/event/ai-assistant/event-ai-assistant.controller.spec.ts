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
import type {
  EventAiAssistantTurnDto,
  EventAiAssistantTurnResponseDto,
} from './dto/event-ai-assistant.dto';
import { EventAiAssistantController } from './event-ai-assistant.controller';
import { emptyDraft } from './event-ai-assistant.fields';
import { EventAiAssistantService } from './event-ai-assistant.service';

const RATE_LIMIT_MAX = 3;

const RESPONSE: EventAiAssistantTurnResponseDto = {
  draft: { ...emptyDraft(), name: 'Calourada' },
  reply: 'Anotado: Calourada.',
  question: {
    field: 'start',
    text: 'Em que dia e a que horas o evento começa?',
    skippable: false,
  },
  missingRequired: ['start', 'end', 'venue'],
  done: false,
};

const turn =
  jest.fn<
    (dto: EventAiAssistantTurnDto) => Promise<EventAiAssistantTurnResponseDto>
  >();

let isOrganizer = false;

const fakeDrizzle = {
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

describe('POST /events/ai-assistant/turn', () => {
  let app: INestApplication;
  let store: RateLimitStore;
  let userToken: string;
  let adminToken: string;

  const post = (body: unknown, token = userToken) =>
    request(app.getHttpServer())
      .post('/events/ai-assistant/turn')
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [EventAiAssistantController],
      providers: [
        { provide: EventAiAssistantService, useValue: { turn } },
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
    turn.mockReset();
    turn.mockResolvedValue(RESPONSE);
  });

  it('responde 200 com a rodada para um organizador', async () => {
    const response = await post({ answer: '  Calourada dia 5/12  ' }).expect(
      200,
    );

    expect(response.body).toEqual(RESPONSE);
    expect(turn).toHaveBeenCalledWith({ answer: 'Calourada dia 5/12' });
  });

  it('aceita o rascunho, o campo e a resposta da rodada anterior', async () => {
    const draft = {
      ...emptyDraft(),
      name: 'Calourada',
      startDate: '2026-12-05',
      ticketTypes: [
        { batch: 'Pista', price: 30, quantity: null, modality: null },
      ],
      skipped: ['category'],
    };

    await post({ draft, field: 'start', answer: 'às 20h' }).expect(200);

    expect(turn).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'start', answer: 'às 20h' }),
    );
    expect(turn.mock.calls[0][0].draft).toMatchObject(draft);
  });

  it('aceita skip sem resposta', async () => {
    await post({ draft: emptyDraft(), field: 'category', skip: true }).expect(
      200,
    );
  });

  it('responde 200 para ADMIN sem organização', async () => {
    isOrganizer = false;

    await post({ answer: 'Show de rock' }, adminToken).expect(200);
  });

  it('responde 401 sem token', async () => {
    await request(app.getHttpServer())
      .post('/events/ai-assistant/turn')
      .send({ answer: 'Show de rock' })
      .expect(401);
  });

  it('responde 403 para comprador sem organização, sem gastar a cota', async () => {
    isOrganizer = false;

    await post({ answer: 'Show de rock' }).expect(403);

    expect(turn).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it.each([
    ['sem resposta', {}, 'Escreva uma resposta para continuar.'],
    [
      'com resposta vazia',
      { answer: '   ' },
      'Escreva uma resposta para continuar.',
    ],
    [
      'com resposta longa demais',
      { answer: 'a'.repeat(2001) },
      'A resposta deve ter no máximo 2000 caracteres.',
    ],
    [
      'com campo desconhecido',
      { field: 'preco', answer: '30' },
      'Campo da pergunta inválido.',
    ],
    [
      'com data fora do formato no rascunho',
      { draft: { ...emptyDraft(), startDate: '05/12/2026' }, answer: 'x' },
      'A data deve estar no formato AAAA-MM-DD.',
    ],
    [
      'com horário fora do formato no rascunho',
      { draft: { ...emptyDraft(), startTime: '8h' }, answer: 'x' },
      'O horário deve estar no formato HH:mm.',
    ],
  ])('responde 400 %s', async (_case, body, message) => {
    const response = await post(body).expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining(message)]),
    );
    expect(turn).not.toHaveBeenCalled();
  });

  it('aceita resposta com exatamente 2000 caracteres', async () => {
    await post({ answer: 'a'.repeat(2000) }).expect(200);
  });

  it('responde 429 com Retry-After quando o organizador estoura o limite', async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await post({ answer: 'Show de rock' }).expect(200);
    }

    const response = await post({ answer: 'Show de rock' }).expect(429);

    expect(response.headers['retry-after']).toBeDefined();
    expect(turn).toHaveBeenCalledTimes(RATE_LIMIT_MAX);
  });

  it('repassa o 503 do serviço', async () => {
    turn.mockRejectedValue(
      new ServiceUnavailableException(
        'Não foi possível entender a resposta com IA. Tente novamente em instantes.',
      ),
    );

    const response = await post({ answer: 'Show de rock' }).expect(503);

    expect(response.body.message).toBe(
      'Não foi possível entender a resposta com IA. Tente novamente em instantes.',
    );
  });
});
