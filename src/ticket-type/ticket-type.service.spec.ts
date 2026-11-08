import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { events, ticketTypes } from '../database/schema';
import { EventService } from '../event/event.service';
import { TicketTypeRepository } from './ticket-type.repository';
import { TicketTypeService } from './ticket-type.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

type TicketTypeRow = typeof ticketTypes.$inferSelect;
type Event = typeof events.$inferSelect;

function makeTicketType(overrides: Partial<TicketTypeRow> = {}): TicketTypeRow {
  return {
    id: 'ticket-type-1',
    eventId: 'event-1',
    batch: '1º Lote',
    price: 100,
    quantity: 100,
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
    hasLinkedTicketsOrOrders: jest.Mock<
      TicketTypeRepository['hasLinkedTicketsOrOrders']
    >;
    countCommitted: jest.Mock<TicketTypeRepository['countCommitted']>;
    withAvailability: jest.Mock;
  };
  let eventService: {
    findOne: jest.Mock<EventService['findOne']>;
    findVisible: jest.Mock<EventService['findVisible']>;
  };

  beforeEach(async () => {
    ticketTypeRepository = {
      findAll: jest.fn<TicketTypeRepository['findAll']>(),
      findById: jest.fn<TicketTypeRepository['findById']>(),
      create: jest.fn<TicketTypeRepository['create']>(),
      update: jest.fn<TicketTypeRepository['update']>(),
      delete: jest.fn<TicketTypeRepository['delete']>(),
      hasLinkedTicketsOrOrders:
        jest.fn<TicketTypeRepository['hasLinkedTicketsOrOrders']>(),
      countCommitted: jest.fn<TicketTypeRepository['countCommitted']>(),
      // Simula 30 vagas comprometidas em cada lote.
      withAvailability: jest.fn(async (rows: TicketTypeRow[]) =>
        rows.map((row) => ({ ...row, available: row.quantity - 30 })),
      ),
    };
    eventService = {
      findOne: jest.fn<EventService['findOne']>(),
      findVisible: jest.fn<EventService['findVisible']>(),
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
    it('repassa o evento e viewer para findVisible e chama o repositório', async () => {
      const rows = [{ ...makeTicketType(), available: 60 }];
      const viewer: AuthenticatedUser = {
        id: 'u-1',
        email: 'user@example.com',
        role: 'USER',
      };
      eventService.findVisible.mockResolvedValue(makeEvent() as never);
      ticketTypeRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll('event-1', viewer);

      expect(eventService.findVisible).toHaveBeenCalledWith('event-1', viewer);
      expect(ticketTypeRepository.findAll).toHaveBeenCalledWith('event-1');
      expect(result).toEqual(rows);
    });

    it('lança NotFound quando o evento não existe ou é rascunho sem permissão', async () => {
      eventService.findVisible.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(service.findAll('event-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketTypeRepository.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna o tipo de ingresso sem checar visibilidade (uso interno)', async () => {
      const ticketType = makeTicketType();
      eventService.findOne.mockResolvedValue(makeEvent() as never);
      ticketTypeRepository.findById.mockResolvedValue(ticketType);

      await expect(
        service.findOne('event-1', 'ticket-type-1'),
      ).resolves.toEqual(ticketType);
      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(ticketTypeRepository.findById).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
    });

    it('lança NotFound quando o tipo de ingresso não existe no evento', async () => {
      eventService.findOne.mockResolvedValue(makeEvent() as never);
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

  describe('findVisible()', () => {
    it('retorna o tipo de ingresso quando ele pertence ao evento visível', async () => {
      const ticketType = makeTicketType();
      const viewer: AuthenticatedUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      };
      eventService.findVisible.mockResolvedValue(makeEvent() as never);
      ticketTypeRepository.findById.mockResolvedValue(ticketType);

      await expect(
        service.findVisible('event-1', 'ticket-type-1', viewer),
      ).resolves.toEqual({ ...ticketType, available: 70 });
      expect(ticketTypeRepository.withAvailability).toHaveBeenCalledWith([
        ticketType,
      ]);
      expect(eventService.findVisible).toHaveBeenCalledWith('event-1', viewer);
      expect(ticketTypeRepository.findById).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
    });

    it('lança NotFound quando o tipo de ingresso não existe no evento', async () => {
      eventService.findVisible.mockResolvedValue(makeEvent() as never);
      ticketTypeRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.findVisible('event-1', 'ticket-type-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança NotFound quando o evento não existe ou não está visível', async () => {
      eventService.findVisible.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.findVisible('event-1', 'ticket-type-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('create()', () => {
    it('cria o tipo de ingresso associado ao evento', async () => {
      const dto = { batch: '1º Lote', price: 100, quantity: 100 };
      const created = makeTicketType(dto);
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.create.mockResolvedValue(created);

      const result = await service.create('event-1', dto);

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(ticketTypeRepository.create).toHaveBeenCalledWith({
        ...dto,
        eventId: 'event-1',
      });
      // Lote novo: nada vendido nem reservado, saldo = capacidade.
      expect(result).toEqual({ ...created, available: 100 });
    });

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(
        new NotFoundException('Evento event-1 não encontrado'),
      );

      await expect(
        service.create('event-1', {
          batch: '1º Lote',
          price: 100,
          quantity: 100,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ticketTypeRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o tipo de ingresso quando ele existe no evento', async () => {
      const dto = { price: 150, quantity: 200 };
      const updated = makeTicketType(dto);
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.countCommitted.mockResolvedValue(50);
      ticketTypeRepository.update.mockResolvedValue(updated);

      const result = await service.update('event-1', 'ticket-type-1', dto);

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(ticketTypeRepository.findById).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
      expect(ticketTypeRepository.countCommitted).toHaveBeenCalledWith(
        'ticket-type-1',
      );
      expect(ticketTypeRepository.update).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
        dto,
      );
      expect(result).toEqual({ ...updated, available: updated.quantity - 30 });
    });

    it('lança UnprocessableEntityException quando a quantidade é menor do que a já vendida/reservada', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.countCommitted.mockResolvedValue(10);

      await expect(
        service.update('event-1', 'ticket-type-1', { quantity: 5 }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(ticketTypeRepository.countCommitted).toHaveBeenCalledWith(
        'ticket-type-1',
      );
      expect(ticketTypeRepository.update).not.toHaveBeenCalled();
    });

    it('atualiza sem consultar countCommitted quando a quantidade não for informada', async () => {
      const dto = { price: 150 };
      const updated = makeTicketType(dto);
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.update.mockResolvedValue(updated);

      const result = await service.update('event-1', 'ticket-type-1', dto);

      expect(ticketTypeRepository.countCommitted).not.toHaveBeenCalled();
      expect(ticketTypeRepository.update).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
        dto,
      );
      expect(result).toEqual({ ...updated, available: updated.quantity - 30 });
    });

    it('lança NotFound quando o tipo de ingresso não existe', async () => {
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
    it('deleta o tipo de ingresso quando ele existe no evento e não tem vendas', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.hasLinkedTicketsOrOrders.mockResolvedValue(false);
      ticketTypeRepository.delete.mockResolvedValue(undefined);

      await service.remove('event-1', 'ticket-type-1');

      expect(eventService.findOne).toHaveBeenCalledWith('event-1');
      expect(ticketTypeRepository.findById).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
      expect(
        ticketTypeRepository.hasLinkedTicketsOrOrders,
      ).toHaveBeenCalledWith('ticket-type-1');
      expect(ticketTypeRepository.delete).toHaveBeenCalledWith(
        'event-1',
        'ticket-type-1',
      );
    });

    it('lança ConflictException quando o tipo de ingresso possui ingressos ou pedidos vinculados', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.hasLinkedTicketsOrOrders.mockResolvedValue(true);

      await expect(service.remove('event-1', 'ticket-type-1')).rejects.toThrow(
        ConflictException,
      );
      expect(ticketTypeRepository.delete).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o banco dispara erro 23503 de chave estrangeira', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.hasLinkedTicketsOrOrders.mockResolvedValue(false);
      ticketTypeRepository.delete.mockRejectedValue({ code: '23503' });

      await expect(service.remove('event-1', 'ticket-type-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança ConflictException quando o Drizzle encapsula erro 23503 em error.cause', async () => {
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeRepository.findById.mockResolvedValue(makeTicketType());
      ticketTypeRepository.hasLinkedTicketsOrOrders.mockResolvedValue(false);
      ticketTypeRepository.delete.mockRejectedValue({
        message: 'DrizzleQueryError',
        cause: { code: '23503' },
      });

      await expect(service.remove('event-1', 'ticket-type-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança NotFound quando o tipo de ingresso não existe', async () => {
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
