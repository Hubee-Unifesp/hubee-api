import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventController } from './event.controller';
import { EventService } from './event.service';

describe('EventController', () => {
  let controller: EventController;
  let service: {
    findAll: jest.Mock<EventService['findAll']>;
    findOne: jest.Mock<EventService['findOne']>;
    create: jest.Mock<EventService['create']>;
    update: jest.Mock<EventService['update']>;
    cancel: jest.Mock<EventService['cancel']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<EventService['findAll']>(),
      findOne: jest.fn<EventService['findOne']>(),
      create: jest.fn<EventService['create']>(),
      update: jest.fn<EventService['update']>(),
      cancel: jest.fn<EventService['cancel']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [{ provide: EventService, useValue: service }],
    }).compile();

    controller = module.get(EventController);
  });

  it('POST /eventos delega para eventService.create()', async () => {
    const dto: CreateEventDto = {
      name: 'Festa Junina 2026',
      organizerId: 'org-1',
      venueId: 'venue-1',
      startDate: new Date('2026-06-20T18:00:00Z'),
      endDate: new Date('2026-06-20T23:00:00Z'),
    };
    const created = { id: 'event-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('GET /eventos delega para eventService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'event-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll({
      organizerId: 'org-1',
      status: 'published',
    });

    expect(service.findAll).toHaveBeenCalledWith({
      organizerId: 'org-1',
      status: 'published',
    });
    expect(result).toEqual(list);
  });

  it('GET /eventos/:id delega para eventService.findOne()', async () => {
    const event = { id: 'event-1' } as never;
    service.findOne.mockResolvedValue(event);

    const result = await controller.findOne('event-1');

    expect(service.findOne).toHaveBeenCalledWith('event-1');
    expect(result).toEqual(event);
  });

  it('PATCH /eventos/:id delega para eventService.update()', async () => {
    const dto: UpdateEventDto = { status: 'published' };
    const updated = { id: 'event-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('event-1', dto);

    expect(service.update).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /eventos/:id delega para eventService.cancel()', async () => {
    service.cancel.mockResolvedValue(undefined);

    await controller.remove('event-1');

    expect(service.cancel).toHaveBeenCalledWith('event-1');
  });
});
