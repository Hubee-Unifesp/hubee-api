import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTicketsDto } from './dto/create-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

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

  it('POST /pedidos/:pedidoId/ingressos delega para ticketService.create()', async () => {
    const dto: CreateTicketsDto = {
      tickets: [{ eventId: 'event-1', ticketTypeId: 'type-1' }],
    };
    const created = [{ id: 'ticket-1' }] as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create('order-1', dto);

    expect(service.create).toHaveBeenCalledWith('order-1', dto);
    expect(result).toEqual(created);
  });

  it('GET /pedidos/:pedidoId/ingressos delega para ticketService.findAllByOrder()', async () => {
    const list = [{ id: 'ticket-1' }] as never;
    service.findAllByOrder.mockResolvedValue(list);

    const result = await controller.findAllByOrder('order-1');

    expect(service.findAllByOrder).toHaveBeenCalledWith('order-1');
    expect(result).toEqual(list);
  });

  it('GET /ingressos/:id delega para ticketService.findOne()', async () => {
    const ticket = { id: 'ticket-1' } as never;
    service.findOne.mockResolvedValue(ticket);

    const result = await controller.findOne('ticket-1');

    expect(service.findOne).toHaveBeenCalledWith('ticket-1');
    expect(result).toEqual(ticket);
  });

  it('PATCH /ingressos/:id delega para ticketService.update()', async () => {
    const dto: UpdateTicketDto = { status: 'usado' };
    const updated = { id: 'ticket-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('ticket-1', dto);

    expect(service.update).toHaveBeenCalledWith('ticket-1', dto);
    expect(result).toEqual(updated);
  });
});
