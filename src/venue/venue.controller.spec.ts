import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';

describe('VenueController', () => {
  let controller: VenueController;
  let service: {
    findAll: jest.Mock<VenueService['findAll']>;
    findOne: jest.Mock<VenueService['findOne']>;
    create: jest.Mock<VenueService['create']>;
    update: jest.Mock<VenueService['update']>;
    remove: jest.Mock<VenueService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<VenueService['findAll']>(),
      findOne: jest.fn<VenueService['findOne']>(),
      create: jest.fn<VenueService['create']>(),
      update: jest.fn<VenueService['update']>(),
      remove: jest.fn<VenueService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VenueController],
      providers: [{ provide: VenueService, useValue: service }],
    }).compile();

    controller = module.get(VenueController);
  });

  it('POST /locais delega para venueService.create()', async () => {
    const dto: CreateVenueDto = {
      name: 'Auditório A',
      maxCapacity: 100,
      addressId: 'addr-1',
    };
    const created = { id: 'venue-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('GET /locais delega para venueService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'venue-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll({ city: 'Recife' });

    expect(service.findAll).toHaveBeenCalledWith({ city: 'Recife' });
    expect(result).toEqual(list);
  });

  it('GET /locais/:id delega para venueService.findOne()', async () => {
    const venue = { id: 'venue-1' } as never;
    service.findOne.mockResolvedValue(venue);

    const result = await controller.findOne('venue-1');

    expect(service.findOne).toHaveBeenCalledWith('venue-1');
    expect(result).toEqual(venue);
  });

  it('PATCH /locais/:id delega para venueService.update()', async () => {
    const dto: UpdateVenueDto = { name: 'Novo nome' };
    const updated = { id: 'venue-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('venue-1', dto);

    expect(service.update).toHaveBeenCalledWith('venue-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /locais/:id delega para venueService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('venue-1');

    expect(service.remove).toHaveBeenCalledWith('venue-1');
  });
});
