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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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

describe('EventService', () => {
  let service: EventService;
  let eventRepository: {
    findAll: jest.Mock<EventRepository['findAll']>;
    findById: jest.Mock<EventRepository['findById']>;
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
      findById: jest.fn<EventRepository['findById']>(),
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
    it('repassa os filtros de organização e status para o repositório', async () => {
      const rows = [makeEvent()];
      eventRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll({
        organizerId: 'org-1',
        status: 'published',
      });

      expect(eventRepository.findAll).toHaveBeenCalledWith({
        organizerId: 'org-1',
        status: 'published',
      });
      expect(result).toEqual(rows);
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
