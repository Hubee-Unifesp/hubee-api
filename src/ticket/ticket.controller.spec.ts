import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTicketsDto } from './dto/create-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { TicketResponseDto } from './dto/ticket-response.dto';

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

describe('TicketController', () => {
  let controller: TicketController;
  let service: {
    create: jest.Mock<TicketService['create']>;
    findAllByOrder: jest.Mock<TicketService['findAllByOrder']>;
    findOne: jest.Mock<TicketService['findOne']>;
    update: jest.Mock<TicketService['update']>;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn<TicketService['create']>(),
      findAllByOrder: jest.fn<TicketService['findAllByOrder']>(),
      findOne: jest.fn<TicketService['findOne']>(),
      update: jest.fn<TicketService['update']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [{ provide: TicketService, useValue: service }],
    }).compile();

    controller = module.get(TicketController);
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

    const result = await controller.findAllByOrder('order-1');

    expect(service.findAllByOrder).toHaveBeenCalledWith('order-1');
    expect(result).toEqual(list);
    expect(result[0]).toBeInstanceOf(TicketResponseDto);
  });

  it('GET /tickets/:id delega para ticketService.findOne()', async () => {
    const ticket = row as never;
    service.findOne.mockResolvedValue(ticket);

    const result = await controller.findOne('ticket-1');

    expect(service.findOne).toHaveBeenCalledWith('ticket-1');
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
