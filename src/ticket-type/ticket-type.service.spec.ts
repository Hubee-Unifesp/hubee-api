import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { events, ticketTypes } from '../database/schema';
import { EventService } from '../event/event.service';
import { TicketTypeRepository } from './ticket-type.repository';
import { TicketTypeService } from './ticket-type.service';

type TicketTypeRow = typeof ticketTypes.$inferSelect;
type Event = typeof events.$inferSelect;

function makeTicketType(overrides: Partial<TicketTypeRow> = {}): TicketTypeRow {
  return {
    id: 'ticket-type-1',
    eventId: 'event-1',
    batch: '1º Lote',
    price: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Festa Junina 2026',
    description: null,
    ageRating: null,
    organizerId: 'org-1',
    venueId: 'venue-1',
    startDate: new Date('2026-06-20T18:00:00Z'),
    endDate: new Date('2026-06-20T23:00:00Z'),
    salesStartDate: null,
    status: 'draft',
    category: null,
    edition: null,
    photoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TicketTypeService', () => {
  let service: TicketTypeService;
  let ticketTypeRepository: {
    findAll: jest.Mock<TicketTypeRepository['findAll']>;
    findById: jest.Mock<TicketTypeRepository['findById']>;
    create: jest.Mock<TicketTypeRepository['create']>;
    update: jest.Mock<TicketTypeRepository['update']>;
    delete: jest.Mock<TicketTypeRepository['delete']>;
  };
  let eventService: {
    findOne: jest.Mock<EventService['findOne']>;
  };

  beforeEach(async () => {
    ticketTypeRepository = {
      findAll: jest.fn<TicketTypeRepository['findAll']>(),
      findById: jest.fn<TicketTypeRepository['findById']>(),
      create: jest.fn<TicketTypeRepository['create']>(),
      update: jest.fn<TicketTypeRepository['update']>(),
      delete: jest.fn<TicketTypeRepository['delete']>(),
    };
    eventService = {
      findOne: jest.fn<EventService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketTypeService,
        { provide: TicketTypeRepository, useValue: ticketTypeRepository },
        { provide: EventService, useValue: eventService },
      ],
    }).compile();

    service = module.get(TicketTypeService);
  });

  describe('findAll()', () => {
    it('repassa o evento para o repositório', async () => {
      const rows = [makeTicketType()];
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll('event-1');

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(ticketTypeRepository.findAll).toHaveBeenCalledWith('event-1');
      expect(result).toEqual(rows);
    });

    it('lança NotFound quando o evento não existe, em vez de lista vazia', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(service.findAll('event-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketTypeRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna o tipo de ingresso quando ele pertence ao evento', async () => {
      const ticketType = makeTicketType();
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(ticketType);

      await expect(
        service.findOne('event-1', 'ticket-type-1'),
      ).resolves.toEqual(ticketType);
      expect(ticketTypeRepository.findById).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
    });

    it('lança NotFound quando o tipo de ingresso não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.findOne('event-1', 'ticket-type-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.findOne('event-1', 'ticket-type-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('cria o tipo de ingresso no evento depois de validar o evento', async () => {
      const created = makeTicketType();
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.create.mockResolvedValue(created);

      const result = await service.create('event-1', {
        batch: '1º Lote',
        price: 100,
      });

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(ticketTypeRepository.create).toHaveBeenCalledWith({
        eventId: 'event-1',
        batch: '1º Lote',
        price: 100,
      });
      expect(result).toEqual(created);
    });

    it('lança NotFound e não cria quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.create('event-1', { batch: '1º Lote', price: 100 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o lote e o valor do tipo de ingresso', async () => {
      const updated = makeTicketType({ batch: '2º Lote', price: 150 });
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.update.mockResolvedValue(updated);

      const result = await service.update('event-1', 'ticket-type-1', {
        batch: '2º Lote',
        price: 150,
      });

      expect(ticketTypeRepository.update).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
        { batch: '2º Lote', price: 150 },
      );
      expect(result).toEqual(updated);
    });

    it('lança NotFound quando o tipo de ingresso não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('event-1', 'ticket-type-1', { price: 150 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.update).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.update('event-1', 'ticket-type-1', { price: 150 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('apaga o tipo de ingresso do evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.delete.mockResolvedValue(undefined);

      await service.remove('event-1', 'ticket-type-1');

      expect(ticketTypeRepository.delete).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
    });

    it('lança NotFound e não apaga quando o tipo de ingresso não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.remove('event-1', 'ticket-type-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.delete).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.remove('event-1', 'ticket-type-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.delete).not.toHaveBeenCalled();
    });
  });
});
