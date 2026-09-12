import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressService } from '../address/address.service';
import { DRIZZLE } from '../database/database.constants';
import { addresses, venues } from '../database/schema';
import { CreateVenueDto } from './dto/create-venue.dto';
import { VenueRepository } from './venue.repository';
import { VenueService } from './venue.service';

type Address = typeof addresses.$inferSelect;
type Venue = typeof venues.$inferSelect;

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'addr-1',
    zipCode: '50000-000',
    street: 'Rua Teste',
    number: '100',
    complement: null,
    neighborhood: 'Centro',
    city: 'Recife',
    state: 'PE',
    country: 'Brasil',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    addressId: 'addr-1',
    name: 'Auditório A',
    maxCapacity: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('VenueService', () => {
  let service: VenueService;
  let venueRepository: {
    findAll: jest.Mock<VenueRepository['findAll']>;
    findById: jest.Mock<VenueRepository['findById']>;
    create: jest.Mock<VenueRepository['create']>;
    update: jest.Mock<VenueRepository['update']>;
    delete: jest.Mock<VenueRepository['delete']>;
  };
  let addressService: {
    create: jest.Mock<AddressService['create']>;
    findById: jest.Mock<AddressService['findById']>;
    update: jest.Mock<AddressService['update']>;
  };
  let db: { transaction: (callback: (tx: unknown) => unknown) => unknown };

  const tx = { marker: 'transaction' } as never;

  beforeEach(async () => {
    venueRepository = {
      findAll: jest.fn<VenueRepository['findAll']>(),
      findById: jest.fn<VenueRepository['findById']>(),
      create: jest.fn<VenueRepository['create']>(),
      update: jest.fn<VenueRepository['update']>(),
      delete: jest.fn<VenueRepository['delete']>(),
    };
    addressService = {
      create: jest.fn<AddressService['create']>(),
      findById: jest.fn<AddressService['findById']>(),
      update: jest.fn<AddressService['update']>(),
    };
    db = {
      transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenueService,
        { provide: DRIZZLE, useValue: db },
        { provide: VenueRepository, useValue: venueRepository },
        { provide: AddressService, useValue: addressService },
      ],
    }).compile();

    service = module.get(VenueService);
  });

  describe('create', () => {
    const baseDto: CreateVenueDto = { name: 'Auditório A', maxCapacity: 100 };

    it('cria o local usando um addressId existente', async () => {
      addressService.findById.mockResolvedValue(makeAddress());
      const venue = makeVenue();
      venueRepository.create.mockResolvedValue(venue);

      const result = await service.create({ ...baseDto, addressId: 'addr-1' });

      expect(addressService.findById).toHaveBeenCalledWith('addr-1', tx);
      expect(venueRepository.create).toHaveBeenCalledWith(
        { name: 'Auditório A', maxCapacity: 100, addressId: 'addr-1' },
        tx,
      );
      expect(result).toEqual(venue);
    });

    it('cria o endereço junto quando "address" é informado', async () => {
      addressService.create.mockResolvedValue(makeAddress({ id: 'addr-novo' }));
      venueRepository.create.mockResolvedValue(
        makeVenue({ addressId: 'addr-novo' }),
      );

      await service.create({
        ...baseDto,
        address: { city: 'Recife' } as never,
      });

      expect(addressService.create).toHaveBeenCalledWith(
        { city: 'Recife' },
        tx,
      );
      expect(venueRepository.create).toHaveBeenCalledWith(
        { name: 'Auditório A', maxCapacity: 100, addressId: 'addr-novo' },
        tx,
      );
    });

    it('lança NotFoundException se o addressId informado não existir', async () => {
      addressService.findById.mockResolvedValue(undefined);

      await expect(
        service.create({ ...baseDto, addressId: 'addr-inexistente' }),
      ).rejects.toThrow(NotFoundException);

      expect(venueRepository.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se não vier addressId nem address', async () => {
      await expect(service.create(baseDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(venueRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('retorna o local quando encontrado', async () => {
      const venueWithAddress = { ...makeVenue(), address: makeAddress() };
      venueRepository.findById.mockResolvedValue(venueWithAddress);

      const result = await service.findOne('venue-1');

      expect(result).toEqual(venueWithAddress);
    });

    it('lança NotFoundException quando o local não existe', async () => {
      venueRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('remove o local quando não há eventos futuros vinculados', async () => {
      venueRepository.findById.mockResolvedValue({
        ...makeVenue(),
        address: makeAddress(),
      });

      await service.remove('venue-1');

      expect(venueRepository.delete).toHaveBeenCalledWith('venue-1');
    });

    it('lança NotFoundException se o local não existir', async () => {
      venueRepository.findById.mockResolvedValue(undefined);

      await expect(service.remove('inexistente')).rejects.toThrow(
        NotFoundException,
      );
      expect(venueRepository.delete).not.toHaveBeenCalled();
    });

    it('lança ConflictException se houver eventos futuros vinculados', async () => {
      venueRepository.findById.mockResolvedValue({
        ...makeVenue(),
        address: makeAddress(),
      });
      jest
        .spyOn(
          service as unknown as { checkUpcomingEvents: () => Promise<boolean> },
          'checkUpcomingEvents',
        )
        .mockResolvedValue(true);

      await expect(service.remove('venue-1')).rejects.toThrow(
        ConflictException,
      );
      expect(venueRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('achata o resultado do join em { ...venue, address }', async () => {
      const venue = makeVenue();
      const address = makeAddress();
      venueRepository.findAll.mockResolvedValue([{ venue, address }]);

      const result = await service.findAll({ city: 'Recife' });

      expect(result).toEqual([{ ...venue, address }]);
    });
  });
});
