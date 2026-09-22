import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeController } from './ticket-type.controller';
import { TicketTypeService } from './ticket-type.service';

describe('TicketTypeController', () => {
  let controller: TicketTypeController;
  let service: {
    findAll: jest.Mock<TicketTypeService['findAll']>;
    findOne: jest.Mock<TicketTypeService['findOne']>;
    create: jest.Mock<TicketTypeService['create']>;
    update: jest.Mock<TicketTypeService['update']>;
    remove: jest.Mock<TicketTypeService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<TicketTypeService['findAll']>(),
      findOne: jest.fn<TicketTypeService['findOne']>(),
      create: jest.fn<TicketTypeService['create']>(),
      update: jest.fn<TicketTypeService['update']>(),
      remove: jest.fn<TicketTypeService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketTypeController],
      providers: [{ provide: TicketTypeService, useValue: service }],
    }).compile();

    controller = module.get(TicketTypeController);
  });

  it('POST /eventos/:eventId/tipos-ingresso delega para ticketTypeService.create()', async () => {
    const dto: CreateTicketTypeDto = { batch: '1º Lote', price: 100 };
    const created = { id: 'ticket-type-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create('event-1', dto);

    expect(service.create).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(created);
  });

  it('GET /eventos/:eventId/tipos-ingresso delega para ticketTypeService.findAll()', async () => {
    const list = [{ id: 'ticket-type-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll('event-1');

    expect(service.findAll).toHaveBeenCalledWith('event-1');
    expect(result).toEqual(list);
  });

  it('GET /eventos/:eventId/tipos-ingresso/:id delega para ticketTypeService.findOne()', async () => {
    const ticketType = { id: 'ticket-type-1' } as never;
    service.findOne.mockResolvedValue(ticketType);

    const result = await controller.findOne('event-1', 'ticket-type-1');

    expect(service.findOne).toHaveBeenCalledWith('event-1', 'ticket-type-1');
    expect(result).toEqual(ticketType);
  });

  it('PATCH /eventos/:eventId/tipos-ingresso/:id delega para ticketTypeService.update()', async () => {
    const dto: UpdateTicketTypeDto = { price: 150 };
    const updated = { id: 'ticket-type-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('event-1', 'ticket-type-1', dto);

    expect(service.update).toHaveBeenCalledWith('event-1', 'ticket-type-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /eventos/:eventId/tipos-ingresso/:id delega para ticketTypeService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('event-1', 'ticket-type-1');

    expect(service.remove).toHaveBeenCalledWith('event-1', 'ticket-type-1');
  });
});
