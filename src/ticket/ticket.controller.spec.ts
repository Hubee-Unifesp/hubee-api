import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTicketsDto } from './dto/create-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import {
  MyTicketResponseDto,
  TicketResponseDto,
} from './dto/ticket-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'ticket-1',
  qrCode: 'qr-1',
  orderId: 'order-1',
  eventId: 'event-1',
  ticketTypeId: 'type-1',
  holderUserId: 'user-1',
  status: 'emitido' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const USER = { id: 'user-1', email: 'user@example.com', role: 'USER' as const };

describe('TicketController', () => {
  let controller: TicketController;
  let service: {
    create: jest.Mock<TicketService['create']>;
    findAllByOrder: jest.Mock<TicketService['findAllByOrder']>;
    findAllByHolder: jest.Mock<TicketService['findAllByHolder']>;
    findOne: jest.Mock<TicketService['findOne']>;
    update: jest.Mock<TicketService['update']>;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn<TicketService['create']>(),
      findAllByOrder: jest.fn<TicketService['findAllByOrder']>(),
      findAllByHolder: jest.fn<TicketService['findAllByHolder']>(),
      findOne: jest.fn<TicketService['findOne']>(),
      update: jest.fn<TicketService['update']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [TicketController],
      providers: [{ provide: TicketService, useValue: service }],
    }).compile();

    controller = module.get(TicketController);
  });

  it('GET /tickets lista os ingressos do usuário logado com evento, local e lote', async () => {
    const mine = [
      {
        ...row,
        event: {
          id: 'event-1',
          name: 'Festa Junina',
          startDate: new Date('2026-06-20T18:00:00Z'),
          endDate: new Date('2026-06-20T23:00:00Z'),
          photoUrl: null,
          organizerId: 'campo-interno',
          venue: {
            id: 'venue-1',
            name: 'Ginásio',
            maxCapacity: 100,
            address: { id: 'address-1', city: 'São Paulo' },
          },
        },
        ticketType: { id: 'type-1', batch: '1º lote', price: 50, quantity: 9 },
      },
    ] as never;
    service.findAllByHolder.mockResolvedValue(mine);

    const result = await controller.findMine(USER);

    expect(service.findAllByHolder).toHaveBeenCalledWith(USER.id);
    expect(result[0]).toBeInstanceOf(MyTicketResponseDto);
    expect(result[0].event.name).toBe('Festa Junina');
    expect(result[0].event.venue.name).toBe('Ginásio');
    expect(result[0].ticketType.batch).toBe('1º lote');
    expect(result[0].event).not.toHaveProperty('organizerId');
    expect(result[0].ticketType).not.toHaveProperty('quantity');
  });

  it('GET /users/me/tickets devolve a mesma lista de GET /tickets', async () => {
    service.findAllByHolder.mockResolvedValue([] as never);

    const result = await controller.findMyTickets(USER);

    expect(service.findAllByHolder).toHaveBeenCalledWith(USER.id);
    expect(result).toEqual([]);
  });

  it('POST /orders/:orderId/tickets delega para ticketService.create()', async () => {
    const dto: CreateTicketsDto = {
      tickets: [{ eventId: 'event-1', ticketTypeId: 'type-1' }],
    };
    const created = [row] as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create('order-1', dto);

    expect(service.create).toHaveBeenCalledWith('order-1', dto);
    expect(result).toEqual(created);
    expect(result[0]).toBeInstanceOf(TicketResponseDto);
  });

  it('GET /orders/:orderId/tickets delega para ticketService.findAllByOrder()', async () => {
    const list = [row] as never;
    service.findAllByOrder.mockResolvedValue(list);

    const result = await controller.findAllByOrder('order-1', USER);

    expect(service.findAllByOrder).toHaveBeenCalledWith('order-1', USER);
    expect(result).toEqual(list);
    expect(result[0]).toBeInstanceOf(TicketResponseDto);
  });

  it('GET /tickets/:id delega para ticketService.findOne()', async () => {
    const ticket = row as never;
    service.findOne.mockResolvedValue(ticket);

    const result = await controller.findOne('ticket-1', USER);

    expect(service.findOne).toHaveBeenCalledWith('ticket-1', USER);
    expect(result).toEqual(ticket);
    expect(result).toBeInstanceOf(TicketResponseDto);
  });

  it('PATCH /tickets/:id delega para ticketService.update()', async () => {
    const dto: UpdateTicketDto = { status: 'usado' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('ticket-1', dto);

    expect(service.update).toHaveBeenCalledWith('ticket-1', dto);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(TicketResponseDto);
  });
});
