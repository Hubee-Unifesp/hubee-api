import { jest } from '@jest/globals';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressResponseDto } from '../address/dto/address-response.dto';
import { OrganizationResponseDto } from '../organization/dto/organization-response.dto';
import { TicketTypeResponseDto } from '../ticket-type/dto/ticket-type-response.dto';
import { VenueResponseDto } from '../venue/dto/venue-response.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventResponseDto } from './dto/event-response.dto';
import { EventDetailResponseDto } from './dto/event-detail-response.dto';
import { EventSummaryResponseDto } from './dto/event-summary-response.dto';
import { EventListItemResponseDto } from './dto/event-list-item-response.dto';
import { EventPageResponseDto } from './dto/event-page-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'event-1',
  name: 'Festa Junina 2026',
  description: null,
  ageRating: null,
  organizerId: 'org-1',
  venueId: 'venue-1',
  startDate: new Date('2026-06-20T18:00:00Z'),
  endDate: new Date('2026-06-20T23:00:00Z'),
  salesStartDate: null,
  status: 'draft' as const,
  category: null,
  edition: null,
  photoUrl: null,
  featured: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const detailRow = {
  ...row,
  status: 'published' as const,
  organization: {
    id: 'org-1',
    name: 'Centro Acadêmico',
    description: 'Agremiação estudantil',
    representativeId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  venue: {
    id: 'venue-1',
    name: 'Espaço Teste',
    maxCapacity: 500,
    active: true,
    addressId: 'addr-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    address: {
      id: 'addr-1',
      zipCode: '12200-000',
      street: 'Av. Cesare Mansueto Giulio Lattes',
      number: '1201',
      complement: null,
      neighborhood: 'Eugênio de Melo',
      city: 'São José dos Campos',
      state: 'SP',
      country: 'Brasil',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  },
  ticketTypes: [
    {
      id: 'tt-1',
      eventId: 'event-1',
      batch: '1º Lote',
      price: 35,
      quantity: 100,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  ],
};

const ADMIN = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

describe('EventController', () => {
  let controller: EventController;
  let service: {
    findAll: jest.Mock<EventService['findAll']>;
    findUpcomingSummaries: jest.Mock<EventService['findUpcomingSummaries']>;
    findVisible: jest.Mock<EventService['findVisible']>;
    create: jest.Mock<EventService['create']>;
    update: jest.Mock<EventService['update']>;
    cancel: jest.Mock<EventService['cancel']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<EventService['findAll']>(),
      findUpcomingSummaries: jest.fn<EventService['findUpcomingSummaries']>(),
      findVisible: jest.fn<EventService['findVisible']>(),
      create: jest.fn<EventService['create']>(),
      update: jest.fn<EventService['update']>(),
      cancel: jest.fn<EventService['cancel']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [EventController],
      providers: [{ provide: EventService, useValue: service }],
    }).compile();

    controller = module.get(EventController);
  });

  it('POST /events delega para eventService.create()', async () => {
    const dto: CreateEventDto = {
      name: 'Festa Junina 2026',
      organizerId: 'org-1',
      venueId: 'venue-1',
      startDate: new Date('2026-06-20T18:00:00Z'),
      endDate: new Date('2026-06-20T23:00:00Z'),
    };
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(EventResponseDto);
  });

  it('GET /events delega para eventService.findAll() com os filtros da query e o usuário', async () => {
    const page = {
      data: [
        {
          ...row,
          venueName: 'Espaço Teste',
          venueCity: 'São Paulo',
          minPrice: 50,
          minPriceBatch: '1º Lote',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    service.findAll.mockResolvedValue(page as never);

    const result = await controller.findAll(
      { organizerId: 'org-1', status: 'draft' },
      ADMIN,
    );

    expect(service.findAll).toHaveBeenCalledWith(
      { organizerId: 'org-1', status: 'draft' },
      ADMIN,
    );
    expect(result).toEqual(page);
    expect(result).toBeInstanceOf(EventPageResponseDto);
    expect(result.data[0]).toBeInstanceOf(EventListItemResponseDto);
  });

  it('GET /events/:id delega para eventService.findVisible() e retorna EventDetailResponseDto', async () => {
    service.findVisible.mockResolvedValue(detailRow);

    const result = await controller.findOne('event-1');

    expect(service.findVisible).toHaveBeenCalledWith('event-1', undefined);
    expect(result).toEqual(detailRow);
    expect(result).toBeInstanceOf(EventDetailResponseDto);
    expect(result.venue).toBeInstanceOf(VenueResponseDto);
    expect(result.venue.address).toBeInstanceOf(AddressResponseDto);
    expect(result.organization).toBeInstanceOf(OrganizationResponseDto);
    expect(result.ticketTypes[0]).toBeInstanceOf(TicketTypeResponseDto);
  });

  it('GET /events/summary delega para eventService.findUpcomingSummaries()', async () => {
    const summary = {
      id: 'event-1',
      name: 'Festa Junina 2026',
      description: null,
      category: null,
      startDate: new Date('2026-06-20T18:00:00Z'),
      endDate: new Date('2026-06-20T23:00:00Z'),
      featured: false,
      organizerName: 'Centro Acadêmico',
      venueName: 'Auditório A',
      venueCity: 'Recife',
      minPrice: 50,
      minPriceBatch: '1º Lote',
      capacity: 100,
      ticketsSold: 10,
    };
    service.findUpcomingSummaries.mockResolvedValue([summary]);

    const result = await controller.findUpcomingSummaries();

    expect(service.findUpcomingSummaries).toHaveBeenCalled();
    expect(result).toEqual([summary]);
    expect(result[0]).toBeInstanceOf(EventSummaryResponseDto);
  });

  it('PATCH /events/:id delega para eventService.update()', async () => {
    const dto: UpdateEventDto = { status: 'published' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('event-1', dto);

    expect(service.update).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(EventResponseDto);
  });

  it('DELETE /events/:id delega para eventService.cancel()', async () => {
    service.cancel.mockResolvedValue(undefined);

    await controller.remove('event-1');

    expect(service.cancel).toHaveBeenCalledWith('event-1');
  });
});

describe('GET /events e GET /events/:id (validação via HTTP)', () => {
  let app: INestApplication;
  let findAll: jest.Mock<EventService['findAll']>;
  let findVisible: jest.Mock<EventService['findVisible']>;

  const emptyPage = {
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };

  beforeAll(async () => {
    findAll = jest.fn<EventService['findAll']>();
    findVisible = jest.fn<EventService['findVisible']>();
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [EventController],
      providers: [
        { provide: EventService, useValue: { findAll, findVisible } },
      ],
    }).compile();

    app = module.createNestApplication();
    // Mesma configuração do main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    findAll.mockReset();
    findAll.mockResolvedValue(emptyPage);
    findVisible.mockReset();
  });

  it('?city=São+Paulo&category=shows responde 200 repassando os filtros', async () => {
    await request(app.getHttpServer())
      .get('/events?city=S%C3%A3o+Paulo&category=shows')
      .expect(200);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'São Paulo',
        category: 'shows',
        page: 1,
        limit: 20,
      }),
      undefined,
    );
  });

  it('sem resultados responde 200 com data vazio e metadados', async () => {
    const response = await request(app.getHttpServer())
      .get('/events?search=inexistente')
      .expect(200);

    expect(response.body).toEqual(emptyPage);
  });

  it.each([
    'startDate=2026-99-99',
    'endDate=amanha',
    'limit=dez',
    'page=0',
    'limit=1000',
    'parametroDesconhecido=1',
  ])('?%s responde 400', async (query) => {
    await request(app.getHttpServer()).get(`/events?${query}`).expect(400);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('GET /events/:id com UUID válido retorna 200 OK com dados aninhados', async () => {
    const validId = '11111111-1111-4111-8111-111111111111';
    findVisible.mockResolvedValue({ ...detailRow, id: validId });

    const response = await request(app.getHttpServer())
      .get(`/events/${validId}`)
      .expect(200);

    expect(findVisible).toHaveBeenCalledWith(validId, undefined);
    expect(response.body).toMatchObject({
      id: validId,
      name: 'Festa Junina 2026',
      status: 'published',
      organization: {
        id: 'org-1',
        name: 'Centro Acadêmico',
      },
      venue: {
        id: 'venue-1',
        name: 'Espaço Teste',
        address: {
          id: 'addr-1',
          city: 'São José dos Campos',
          state: 'SP',
        },
      },
      ticketTypes: [
        {
          id: 'tt-1',
          batch: '1º Lote',
          price: 35,
          quantity: 100,
        },
      ],
    });
  });

  it('GET /events/:id com UUID inválido responde 400 Bad Request pelo ParseUUIDPipe', async () => {
    await request(app.getHttpServer()).get('/events/uuid-invalido').expect(400);
    expect(findVisible).not.toHaveBeenCalled();
  });

  it('GET /events/:id para evento inexistente ou não publicado responde 404 Not Found', async () => {
    const missingId = '22222222-2222-4222-8222-222222222222';
    findVisible.mockRejectedValue(
      new NotFoundException(`Evento ${missingId} não encontrado`),
    );

    await request(app.getHttpServer()).get(`/events/${missingId}`).expect(404);
    expect(findVisible).toHaveBeenCalledWith(missingId, undefined);
  });
});
