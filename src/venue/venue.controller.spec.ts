import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { AddressResponseDto } from '../address/dto/address-response.dto';
import { VenueResponseDto } from './dto/venue-response.dto';

const address = {
  id: 'addr-1',
  zipCode: '50000-000',
  street: 'Rua do Sol',
  number: '100',
  complement: null,
  neighborhood: 'Boa Vista',
  city: 'Recife',
  state: 'PE',
  country: 'Brasil',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

/** Venue como o service retorna: linha do banco + endereço aninhado. */
const row = {
  id: 'venue-1',
  name: 'Auditório A',
  maxCapacity: 100,
  active: true,
  addressId: 'addr-1',
  address,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function expectVenueResponse(result: unknown) {
  expect(result).toBeInstanceOf(VenueResponseDto);
  expect((result as VenueResponseDto).address).toBeInstanceOf(
    AddressResponseDto,
  );
  expect(result).toEqual(row);
}

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
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [VenueController],
      providers: [{ provide: VenueService, useValue: service }],
    }).compile();

    controller = module.get(VenueController);
  });

  it('POST /venues delega para venueService.create()', async () => {
    const dto: CreateVenueDto = {
      name: 'Auditório A',
      maxCapacity: 100,
      addressId: 'addr-1',
    };
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expectVenueResponse(result);
  });

  it('GET /venues delega para venueService.findAll() com os filtros da query', async () => {
    const list = [row] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll({ city: 'Recife' });

    expect(service.findAll).toHaveBeenCalledWith({ city: 'Recife' });
    expect(result).toHaveLength(1);
    expectVenueResponse(result[0]);
  });

  it('GET /venues/:id delega para venueService.findOne()', async () => {
    const venue = row as never;
    service.findOne.mockResolvedValue(venue);

    const result = await controller.findOne('venue-1');

    expect(service.findOne).toHaveBeenCalledWith('venue-1');
    expectVenueResponse(result);
  });

  it('PATCH /venues/:id delega para venueService.update()', async () => {
    const dto: UpdateVenueDto = { name: 'Novo nome' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('venue-1', dto);

    expect(service.update).toHaveBeenCalledWith('venue-1', dto);
    expectVenueResponse(result);
  });

  it('DELETE /venues/:id delega para venueService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('venue-1');

    expect(service.remove).toHaveBeenCalledWith('venue-1');
  });
});
