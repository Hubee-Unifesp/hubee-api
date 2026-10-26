import { jest } from '@jest/globals';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { events } from '../database/schema';
import { OrganizationService } from '../organization/organization.service';
import { VenueService } from '../venue/venue.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

type Event = typeof events.$inferSelect;
type EventDetail = NonNullable<
  Awaited<ReturnType<EventRepository['findDetailById']>>
>;

const START = new Date('2026-06-20T18:00:00Z');
const END = new Date('2026-06-20T23:00:00Z');
const SALES_START = new Date('2026-05-01T12:00:00Z');

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Festa Junina 2026',
    description: null,
    ageRating: null,
    organizerId: 'org-1',
    venueId: 'venue-1',
    startDate: START,
    endDate: END,
    salesStartDate: SALES_START,
    status: 'draft',
    category: null,
    edition: null,
    photoUrl: null,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEventDetail(overrides: Partial<Event> = {}): EventDetail {
  const now = new Date();
  return {
    ...makeEvent(overrides),
    organization: {
      id: 'org-1',
      name: 'Centro Acadêmico',
      description: null,
      representativeId: null,
      createdAt: now,
      updatedAt: now,
    },
    venue: {
      id: 'venue-1',
      name: 'Espaço Teste',
      maxCapacity: 500,
      active: true,
      addressId: 'addr-1',
      createdAt: now,
      updatedAt: now,
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
        createdAt: now,
        updatedAt: now,
      },
    },
    ticketTypes: [
      {
        id: 'tt-1',
        eventId: 'event-1',
        batch: '1º Lote',
        price: 35,
        quantity: 100,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function makeCreateDto(
  overrides: Partial<CreateEventDto> = {},
): CreateEventDto {
  return {
    name: 'Festa Junina 2026',
    organizerId: 'org-1',
    venueId: 'venue-1',
    startDate: START,
    endDate: END,
    salesStartDate: SALES_START,
    ...overrides,
  };
}

const USER = { id: 'user-1', email: 'user@example.com', role: 'USER' as const };
const ADMIN = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

describe('EventService', () => {
  let service: EventService;
  let eventRepository: {
    findAll: jest.Mock<EventRepository['findAll']>;
    findUpcomingSummaries: jest.Mock<EventRepository['findUpcomingSummaries']>;
    findById: jest.Mock<EventRepository['findById']>;
    findDetailById: jest.Mock<EventRepository['findDetailById']>;
    create: jest.Mock<EventRepository['create']>;
    update: jest.Mock<EventRepository['update']>;
  };
  let organizationService: {
    findOne: jest.Mock<OrganizationService['findOne']>;
  };
  let venueService: {
    findOne: jest.Mock<VenueService['findOne']>;
  };

  beforeEach(async () => {
    eventRepository = {
      findAll: jest.fn<EventRepository['findAll']>(),
      findUpcomingSummaries:
        jest.fn<EventRepository['findUpcomingSummaries']>(),
      findById: jest.fn<EventRepository['findById']>(),
      findDetailById: jest.fn<EventRepository['findDetailById']>(),
      create: jest.fn<EventRepository['create']>(),
      update: jest.fn<EventRepository['update']>(),
    };
    organizationService = {
      findOne: jest.fn<OrganizationService['findOne']>(),
    };
    venueService = {
      findOne: jest.fn<VenueService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: EventRepository, useValue: eventRepository },
        { provide: OrganizationService, useValue: organizationService },
        { provide: VenueService, useValue: venueService },
      ],
    }).compile();

    service = module.get(EventService);
  });

  describe('findAll()', () => {
    const listItem = (overrides: Partial<Event> = {}) => ({
      ...makeEvent({ featured: false, ...overrides }),
      venueName: 'Espaço Teste',
      venueCity: 'São Paulo',
      minPrice: 50,
      minPriceBatch: '1º Lote',
    });

    it('repassa os filtros de organização e status para o repositório quando ADMIN', async () => {
      const rows = [listItem()];
      eventRepository.findAll.mockResolvedValue({ data: rows, total: 1 });

      const result = await service.findAll(
        { organizerId: 'org-1', status: 'draft' },
        ADMIN,
      );

      expect(eventRepository.findAll).toHaveBeenCalledWith(
        { organizerId: 'org-1', status: 'draft' },
        { page: 1, limit: 20 },
      );
      expect(result).toEqual({
        data: rows,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it.each([
      ['anônimo', undefined],
      ['USER', USER],
    ])(
      'força status published para %s, ignorando o filtro da query',
      async (_label, viewer) => {
        eventRepository.findAll.mockResolvedValue({ data: [], total: 0 });

        await service.findAll(
          { organizerId: 'org-1', status: 'draft' },
          viewer,
        );

        expect(eventRepository.findAll).toHaveBeenCalledWith(
          { organizerId: 'org-1', status: 'published' },
          { page: 1, limit: 20 },
        );
      },
    );

    it('repassa busca, categoria, cidade e período separados da paginação', async () => {
      eventRepository.findAll.mockResolvedValue({ data: [], total: 0 });
      const startDate = new Date('2026-10-01T00:00:00Z');
      const endDate = new Date('2026-10-31T00:00:00Z');

      await service.findAll({
        search: 'festa',
        category: 'shows',
        city: 'São Paulo',
        startDate,
        endDate,
        page: 3,
        limit: 5,
      });

      expect(eventRepository.findAll).toHaveBeenCalledWith(
        {
          search: 'festa',
          category: 'shows',
          city: 'São Paulo',
          startDate,
          endDate,
          status: 'published',
        },
        { page: 3, limit: 5 },
      );
    });

    it('calcula o total de páginas a partir do total e do limite', async () => {
      eventRepository.findAll.mockResolvedValue({
        data: [listItem()],
        total: 21,
      });

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('sem resultados devolve lista vazia com os metadados', async () => {
      eventRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await service.findAll({ city: 'Lugar Nenhum' });

      expect(result).toEqual({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('lança 400 quando a data final é anterior à inicial', async () => {
      await expect(
        service.findAll({
          startDate: new Date('2026-10-31T00:00:00Z'),
          endDate: new Date('2026-10-01T00:00:00Z'),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(eventRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findUpcomingSummaries()', () => {
    it('repassa a consulta de resumos para o repositório', async () => {
      const summaries = [{ id: 'event-1' }] as never;
      eventRepository.findUpcomingSummaries.mockResolvedValue(summaries);

      await expect(service.findUpcomingSummaries()).resolves.toEqual(summaries);
      expect(eventRepository.findUpcomingSummaries).toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna o evento encontrado', async () => {
      const event = makeEvent();
      eventRepository.findById.mockResolvedValue(event);

      await expect(service.findOne('event-1')).resolves.toEqual(event);
    });

    it('lança 404 quando o evento não existe', async () => {
      eventRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne('event-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findVisible()', () => {
    it.each([
      ['anônimo', undefined],
      ['USER', USER],
      ['ADMIN', ADMIN],
    ])('retorna evento publicado para %s', async (_label, viewer) => {
      const event = makeEventDetail({ status: 'published' });
      eventRepository.findDetailById.mockResolvedValue(event);

      await expect(service.findVisible('event-1', viewer)).resolves.toEqual(
        event,
      );
    });

    it.each(['draft', 'finished', 'cancelled'] as const)(
      'responde 404 para evento %s quando não é ADMIN',
      async (status) => {
        eventRepository.findDetailById.mockResolvedValue(
          makeEventDetail({ status }),
        );

        await expect(service.findVisible('event-1')).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(
          service.findVisible('event-1', USER),
        ).rejects.toBeInstanceOf(NotFoundException);
      },
    );

    it('retorna evento não publicado para ADMIN', async () => {
      const event = makeEventDetail({ status: 'draft' });
      eventRepository.findDetailById.mockResolvedValue(event);

      await expect(service.findVisible('event-1', ADMIN)).resolves.toEqual(
        event,
      );
    });

    it('lança 404 quando o evento não existe', async () => {
      eventRepository.findDetailById.mockResolvedValue(undefined);

      await expect(
        service.findVisible('event-404', ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create()', () => {
    it('cria o evento depois de validar organizador e local', async () => {
      const dto = makeCreateDto();
      const created = makeEvent();
      organizationService.findOne.mockResolvedValue({} as never);
      venueService.findOne.mockResolvedValue({} as never);
      eventRepository.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(organizationService.findOne).toHaveBeenCalledWith('org-1');
      expect(venueService.findOne).toHaveBeenCalledWith('venue-1');
      expect(eventRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });

    it('lança 400 quando a data de término não é posterior à de início', async () => {
      const dto = makeCreateDto({ endDate: START });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(eventRepository.create).not.toHaveBeenCalled();
    });

    it('lança 400 quando as vendas começam depois do início do evento', async () => {
      const dto = makeCreateDto({
        salesStartDate: new Date('2026-06-21T00:00:00Z'),
      });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(eventRepository.create).not.toHaveBeenCalled();
    });

    it('aceita evento sem data de início de vendas', async () => {
      const dto = makeCreateDto({ salesStartDate: undefined });
      organizationService.findOne.mockResolvedValue({} as never);
      venueService.findOne.mockResolvedValue({} as never);
      eventRepository.create.mockResolvedValue(makeEvent());

      await expect(service.create(dto)).resolves.toBeDefined();
      expect(eventRepository.create).toHaveBeenCalledWith(dto);
    });

    it('lança 404 quando a organização organizadora não existe', async () => {
      organizationService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(makeCreateDto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(eventRepository.create).not.toHaveBeenCalled();
    });

    it('lança 404 quando o local não existe', async () => {
      organizationService.findOne.mockResolvedValue({} as never);
      venueService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(makeCreateDto())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(eventRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza os campos enviados', async () => {
      const event = makeEvent();
      const updated = makeEvent({
        name: 'Festa Junina 2026 - Edição Especial',
      });
      eventRepository.findById.mockResolvedValue(event);
      eventRepository.update.mockResolvedValue(updated);

      const dto = { name: 'Festa Junina 2026 - Edição Especial' };
      const result = await service.update('event-1', dto);

      expect(eventRepository.update).toHaveBeenCalledWith('event-1', dto);
      expect(result).toEqual(updated);
    });

    it('lança 404 quando o evento não existe', async () => {
      eventRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('event-404', { name: 'Novo nome' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventRepository.update).not.toHaveBeenCalled();
    });

    it('recusa alteração de evento cancelado', async () => {
      eventRepository.findById.mockResolvedValue(
        makeEvent({ status: 'cancelled' }),
      );

      await expect(
        service.update('event-1', { name: 'Novo nome' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(eventRepository.update).not.toHaveBeenCalled();
    });

    it('valida a nova data contra a data já gravada', async () => {
      eventRepository.findById.mockResolvedValue(makeEvent());

      await expect(
        service.update('event-1', {
          startDate: new Date('2026-06-21T00:00:00Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(eventRepository.update).not.toHaveBeenCalled();
    });

    it('valida o novo local quando o evento muda de lugar', async () => {
      eventRepository.findById.mockResolvedValue(makeEvent());
      venueService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.update('event-1', { venueId: 'venue-404' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventRepository.update).not.toHaveBeenCalled();
    });

    it('não revalida o local quando ele não muda', async () => {
      eventRepository.findById.mockResolvedValue(makeEvent());
      eventRepository.update.mockResolvedValue(makeEvent());

      await service.update('event-1', { venueId: 'venue-1' });

      expect(venueService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('marca o evento como cancelado', async () => {
      eventRepository.findById.mockResolvedValue(makeEvent());
      eventRepository.update.mockResolvedValue(
        makeEvent({ status: 'cancelled' }),
      );

      await service.cancel('event-1');

      expect(eventRepository.update).toHaveBeenCalledWith('event-1', {
        status: 'cancelled',
      });
    });

    it('lança 404 quando o evento não existe', async () => {
      eventRepository.findById.mockResolvedValue(undefined);

      await expect(service.cancel('event-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(eventRepository.update).not.toHaveBeenCalled();
    });

    it('recusa cancelar um evento já cancelado', async () => {
      eventRepository.findById.mockResolvedValue(
        makeEvent({ status: 'cancelled' }),
      );

      await expect(service.cancel('event-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(eventRepository.update).not.toHaveBeenCalled();
    });
  });
});
