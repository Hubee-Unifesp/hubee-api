import { jest } from '@jest/globals';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { events, orders, ticketTypes, tickets } from '../database/schema';
import { EventService } from '../event/event.service';
import { OrderService } from '../order/order.service';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { TicketRepository } from './ticket.repository';
import { TicketService } from './ticket.service';

type Ticket = typeof tickets.$inferSelect;
type Order = typeof orders.$inferSelect;
type Event = typeof events.$inferSelect;
type TicketType = typeof ticketTypes.$inferSelect;

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    qrCode: 'qr-1',
    orderId: 'order-1',
    eventId: 'event-1',
    ticketTypeId: 'type-1',
    holderUserId: 'user-1',
    status: 'emitido',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    userId: 'buyer-1',
    status: 'pago',
    totalAmount: 100,
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
    status: 'published',
    category: null,
    edition: null,
    photoUrl: null,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTicketType(overrides: Partial<TicketType> = {}): TicketType {
  return {
    id: 'type-1',
    eventId: 'event-1',
    batch: '1º lote',
    price: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TicketService', () => {
  let service: TicketService;
  let ticketRepository: {
    findAllByOrder: jest.Mock<TicketRepository['findAllByOrder']>;
    findById: jest.Mock<TicketRepository['findById']>;
    createMany: jest.Mock<TicketRepository['createMany']>;
    updateStatus: jest.Mock<TicketRepository['updateStatus']>;
  };
  let orderService: { findOne: jest.Mock<OrderService['findOne']> };
  let eventService: { findOne: jest.Mock<EventService['findOne']> };
  let ticketTypeService: {
    findOne: jest.Mock<TicketTypeService['findOne']>;
  };
  let usuariosService: { findOne: jest.Mock<UsuariosService['findOne']> };

  beforeEach(async () => {
    ticketRepository = {
      findAllByOrder: jest.fn<TicketRepository['findAllByOrder']>(),
      findById: jest.fn<TicketRepository['findById']>(),
      createMany: jest.fn<TicketRepository['createMany']>(),
      updateStatus: jest.fn<TicketRepository['updateStatus']>(),
    };
    orderService = { findOne: jest.fn<OrderService['findOne']>() };
    eventService = { findOne: jest.fn<EventService['findOne']>() };
    ticketTypeService = {
      findOne: jest.fn<TicketTypeService['findOne']>(),
    };
    usuariosService = { findOne: jest.fn<UsuariosService['findOne']>() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        { provide: TicketRepository, useValue: ticketRepository },
        { provide: OrderService, useValue: orderService },
        { provide: EventService, useValue: eventService },
        { provide: TicketTypeService, useValue: ticketTypeService },
        { provide: UsuariosService, useValue: usuariosService },
      ],
    }).compile();

    service = module.get(TicketService);
  });

  describe('findAllByOrder()', () => {
    it('lista os ingressos do pedido', async () => {
      const rows = [makeTicket()];
      orderService.findOne.mockResolvedValue(makeOrder());
      ticketRepository.findAllByOrder.mockResolvedValue(rows);

      const result = await service.findAllByOrder('order-1');

      expect(orderService.findOne).toHaveBeenCalledWith('order-1');
      expect(ticketRepository.findAllByOrder).toHaveBeenCalledWith('order-1');
      expect(result).toEqual(rows);
    });

    it('lança NotFound quando o pedido não existe, em vez de lista vazia', async () => {
      orderService.findOne.mockRejectedValue(
        new NotFoundException('Pedido order-1 não encontrado'),
      );

      await expect(service.findAllByOrder('order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketRepository.findAllByOrder).not.toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('retorna o ingresso quando ele existe', async () => {
      const ticket = makeTicket();
      ticketRepository.findById.mockResolvedValue(ticket);

      await expect(service.findOne('ticket-1')).resolves.toEqual(ticket);
    });

    it('lança NotFound quando o ingresso não existe', async () => {
      ticketRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne('ticket-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    const dto = {
      tickets: [
        { eventId: 'event-1', ticketTypeId: 'type-1', holderUserId: 'user-1' },
        { eventId: 'event-1', ticketTypeId: 'type-1' },
      ],
    };

    beforeEach(() => {
      orderService.findOne.mockResolvedValue(makeOrder());
      eventService.findOne.mockResolvedValue(makeEvent());
      ticketTypeService.findOne.mockResolvedValue(makeTicketType());
      usuariosService.findOne.mockResolvedValue({} as never);
      ticketRepository.createMany.mockImplementation((data) =>
        Promise.resolve(data.map((row) => makeTicket(row))),
      );
    });

    it('emite um ingresso por item, com QR code próprio e titular padrão igual ao comprador', async () => {
      await service.create('order-1', dto);

      const [rows] = ticketRepository.createMany.mock.calls[0];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        orderId: 'order-1',
        eventId: 'event-1',
        ticketTypeId: 'type-1',
        holderUserId: 'user-1',
      });
      expect(rows[1].holderUserId).toBe('buyer-1');
      expect(rows[0].qrCode).toEqual(expect.any(String));
      expect(rows[0].qrCode).not.toBe(rows[1].qrCode);
    });

    it('valida cada evento, tipo e titular uma única vez, mesmo repetidos', async () => {
      await service.create('order-1', {
        tickets: [
          { eventId: 'event-1', ticketTypeId: 'type-1' },
          { eventId: 'event-1', ticketTypeId: 'type-1' },
        ],
      });

      expect(eventService.findOne).toHaveBeenCalledTimes(1);
      expect(ticketTypeService.findOne).toHaveBeenCalledTimes(1);
      expect(ticketTypeService.findOne).toHaveBeenCalledWith(
        'event-1',
        'type-1',
      );
      expect(usuariosService.findOne).toHaveBeenCalledTimes(1);
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketRepository.createMany).not.toHaveBeenCalled();
    });

    it.each(['pendente', 'cancelado'] as const)(
      'lança 422 quando o pedido está %s',
      async (status) => {
        orderService.findOne.mockResolvedValue(makeOrder({ status }));

        await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(
          UnprocessableEntityException,
        );
        expect(ticketRepository.createMany).not.toHaveBeenCalled();
      },
    );

    it('lança NotFound quando o evento não existe', async () => {
      eventService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketRepository.createMany).not.toHaveBeenCalled();
    });

    it('lança 422 quando o evento está cancelado', async () => {
      eventService.findOne.mockResolvedValue(
        makeEvent({ status: 'cancelled' }),
      );

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(ticketRepository.createMany).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o tipo de ingresso não pertence ao evento informado', async () => {
      ticketTypeService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketRepository.createMany).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o titular não existe, sem criar nenhum ingresso do lote', async () => {
      usuariosService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create('order-1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketRepository.createMany).not.toHaveBeenCalled();
    });

    it('propaga erros inesperados ao consultar o titular', async () => {
      const boom = new Error('db down');
      usuariosService.findOne.mockRejectedValue(boom);

      await expect(service.create('order-1', dto)).rejects.toBe(boom);
    });
  });

  describe('update()', () => {
    it.each(['usado', 'cancelado'] as const)(
      'muda de emitido para %s',
      async (status) => {
        const updated = makeTicket({ status });
        ticketRepository.findById.mockResolvedValue(makeTicket());
        ticketRepository.updateStatus.mockResolvedValue(updated);

        const result = await service.update('ticket-1', { status });

        expect(ticketRepository.updateStatus).toHaveBeenCalledWith(
          'ticket-1',
          'emitido',
          status,
        );
        expect(result).toEqual(updated);
      },
    );

    it.each([
      ['emitido', 'emitido'],
      ['usado', 'emitido'],
      ['usado', 'cancelado'],
      ['cancelado', 'emitido'],
      ['cancelado', 'usado'],
    ] as const)('lança 422 ao tentar %s → %s', async (from, to) => {
      ticketRepository.findById.mockResolvedValue(makeTicket({ status: from }));

      await expect(
        service.update('ticket-1', { status: to }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(ticketRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o ingresso não existe', async () => {
      ticketRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('ticket-1', { status: 'usado' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lança 422 quando outra requisição mudou o status antes (dupla leitura na portaria)', async () => {
      ticketRepository.findById.mockResolvedValue(makeTicket());
      ticketRepository.updateStatus.mockResolvedValue(undefined);

      await expect(
        service.update('ticket-1', { status: 'usado' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
