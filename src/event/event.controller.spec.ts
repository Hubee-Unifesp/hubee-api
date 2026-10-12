import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventResponseDto } from './dto/event-response.dto';
import { EventSummaryResponseDto } from './dto/event-summary-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'event-1',
  name: 'Festa Junina 2026',
  description: null,
  ageRating: null,
  organizerId: 'org-1',
  venueId: 'venue-1',
  startDate: new Date('2026-06-20T18:00:00Z'),
  endDate: new Date('2026-06-20T23:00:00Z'),
  salesStartDate: null,
  status: 'draft' as const,
  category: null,
  edition: null,
  photoUrl: null,
  featured: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('EventController', () => {
  let controller: EventController;
  let service: {
    findAll: jest.Mock<EventService['findAll']>;
    findUpcomingSummaries: jest.Mock<EventService['findUpcomingSummaries']>;
    findOne: jest.Mock<EventService['findOne']>;
    create: jest.Mock<EventService['create']>;
    update: jest.Mock<EventService['update']>;
    cancel: jest.Mock<EventService['cancel']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<EventService['findAll']>(),
      findUpcomingSummaries: jest.fn<EventService['findUpcomingSummaries']>(),
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

  it('POST /events delega para eventService.create()', async () => {
    const dto: CreateEventDto = {
      name: 'Festa Junina 2026',
      organizerId: 'org-1',
      venueId: 'venue-1',
      startDate: new Date('2026-06-20T18:00:00Z'),
      endDate: new Date('2026-06-20T23:00:00Z'),
    };
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(EventResponseDto);
  });

  it('GET /events delega para eventService.findAll() com os filtros da query', async () => {
    const list = [row] as never;
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
    expect(result[0]).toBeInstanceOf(EventResponseDto);
  });

  it('GET /events/:id delega para eventService.findOne()', async () => {
    const event = row as never;
    service.findOne.mockResolvedValue(event);

    const result = await controller.findOne('event-1');

    expect(service.findOne).toHaveBeenCalledWith('event-1');
    expect(result).toEqual(event);
    expect(result).toBeInstanceOf(EventResponseDto);
  });

  it('GET /events/summary delega para eventService.findUpcomingSummaries()', async () => {
    const summary = {
      id: 'event-1',
      name: 'Festa Junina 2026',
      description: null,
      category: null,
      startDate: new Date('2026-06-20T18:00:00Z'),
      endDate: new Date('2026-06-20T23:00:00Z'),
      featured: false,
      organizerName: 'Centro Acadêmico',
      venueName: 'Auditório A',
      venueCity: 'Recife',
      minPrice: 50,
      minPriceBatch: '1º Lote',
      capacity: 100,
      ticketsSold: 10,
    };
    service.findUpcomingSummaries.mockResolvedValue([summary]);

    const result = await controller.findUpcomingSummaries();

    expect(service.findUpcomingSummaries).toHaveBeenCalled();
    expect(result).toEqual([summary]);
    expect(result[0]).toBeInstanceOf(EventSummaryResponseDto);
  });

  it('PATCH /events/:id delega para eventService.update()', async () => {
    const dto: UpdateEventDto = { status: 'published' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('event-1', dto);

    expect(service.update).toHaveBeenCalledWith('event-1', dto);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(EventResponseDto);
  });

  it('DELETE /events/:id delega para eventService.cancel()', async () => {
    service.cancel.mockResolvedValue(undefined);

    await controller.remove('event-1');

    expect(service.cancel).toHaveBeenCalledWith('event-1');
  });
});
