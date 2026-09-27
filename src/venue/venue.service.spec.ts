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
    active: true,
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
    findByNameCapacityAndAddress: jest.Mock<
      VenueRepository['findByNameCapacityAndAddress']
    >;
    create: jest.Mock<VenueRepository['create']>;
    update: jest.Mock<VenueRepository['update']>;
    delete: jest.Mock<VenueRepository['delete']>;
    hasUpcomingEvents: jest.Mock<VenueRepository['hasUpcomingEvents']>;
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
      findByNameCapacityAndAddress:
        jest.fn<VenueRepository['findByNameCapacityAndAddress']>(),
      create: jest.fn<VenueRepository['create']>(),
      update: jest.fn<VenueRepository['update']>(),
      delete: jest.fn<VenueRepository['delete']>(),
      hasUpcomingEvents: jest
        .fn<VenueRepository['hasUpcomingEvents']>()
        .mockResolvedValue(false),
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
      venueRepository.findByNameCapacityAndAddress.mockResolvedValue(undefined);
      const venue = makeVenue();
      const venueWithAddress = { ...venue, address: makeAddress() };
      venueRepository.create.mockResolvedValue(venue);
      venueRepository.findById.mockResolvedValue(venueWithAddress);

      const result = await service.create({ ...baseDto, addressId: 'addr-1' });

      expect(addressService.findById).toHaveBeenCalledWith('addr-1', tx);
      expect(venueRepository.create).toHaveBeenCalledWith(
        { name: 'Auditório A', maxCapacity: 100, addressId: 'addr-1' },
        tx,
      );
      expect(venueRepository.findById).toHaveBeenCalledWith('venue-1');
      expect(result).toEqual(venueWithAddress);
    });

    it('retorna a venue existente com os mesmos dados', async () => {
      addressService.findById.mockResolvedValue(makeAddress());
      const venue = makeVenue();
      const venueWithAddress = { ...venue, address: makeAddress() };
      venueRepository.findByNameCapacityAndAddress.mockResolvedValue(venue);
      venueRepository.findById.mockResolvedValue(venueWithAddress);

      const result = await service.create({
        ...baseDto,
        addressId: 'addr-1',
      });

      expect(venueRepository.findByNameCapacityAndAddress).toHaveBeenCalledWith(
        'Auditório A',
        100,
        'addr-1',
        tx,
      );
      expect(venueRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(venueWithAddress);
    });

    it('cria o endereço junto quando "address" é informado', async () => {
      addressService.create.mockResolvedValue(makeAddress({ id: 'addr-novo' }));
      venueRepository.findByNameCapacityAndAddress.mockResolvedValue(undefined);
      venueRepository.create.mockResolvedValue(
        makeVenue({ addressId: 'addr-novo' }),
      );
      venueRepository.findById.mockResolvedValue({
        ...makeVenue({ addressId: 'addr-novo' }),
        address: makeAddress({ id: 'addr-novo' }),
      });

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

    it('prioriza "address" quando addressId e address são informados', async () => {
      addressService.create.mockResolvedValue(makeAddress({ id: 'addr-novo' }));
      venueRepository.findByNameCapacityAndAddress.mockResolvedValue(undefined);
      venueRepository.create.mockResolvedValue(
        makeVenue({ addressId: 'addr-novo' }),
      );
      venueRepository.findById.mockResolvedValue({
        ...makeVenue({ addressId: 'addr-novo' }),
        address: makeAddress({ id: 'addr-novo' }),
      });

      await service.create({
        ...baseDto,
        addressId: 'addr-existente',
        address: { city: 'Recife' } as never,
      });

      expect(addressService.create).toHaveBeenCalledWith(
        { city: 'Recife' },
        tx,
      );
      expect(addressService.findById).not.toHaveBeenCalled();
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

  describe('update', () => {
    it.each([false, true])(
      'respeita active=false na troca de endereço (local equivalente existente: %s)',
      async (hasExisting) => {
        const currentVenue = makeVenue();
        const nextVenue = makeVenue({
          id: 'venue-2',
          addressId: 'addr-2',
          active: false,
        });
        const nextWithAddress = {
          ...nextVenue,
          address: makeAddress({ id: 'addr-2' }),
        };
        venueRepository.findById
          .mockResolvedValueOnce({ ...currentVenue, address: makeAddress() })
          .mockResolvedValueOnce(nextWithAddress);
        addressService.findById.mockResolvedValue(
          makeAddress({ id: 'addr-2' }),
        );
        venueRepository.findByNameCapacityAndAddress.mockResolvedValue(
          hasExisting
            ? makeVenue({ id: 'venue-3', addressId: 'addr-2' })
            : undefined,
        );
        venueRepository.create.mockResolvedValue(nextVenue);
        venueRepository.update.mockResolvedValue({
          ...currentVenue,
          active: false,
        });

        const result = await service.update('venue-1', {
          addressId: 'addr-2',
          active: false,
        });

        expect(result).toEqual(nextWithAddress);
        expect(venueRepository.create).toHaveBeenCalledWith(
          {
            name: currentVenue.name,
            maxCapacity: currentVenue.maxCapacity,
            addressId: 'addr-2',
            active: false,
          },
          tx,
        );
        expect(venueRepository.update).toHaveBeenCalledWith(
          'venue-1',
          { active: false },
          tx,
        );
        expect(venueRepository.update).toHaveBeenCalledTimes(1);
      },
    );

    it('desativa a venue atual e cria uma nova quando o endereço muda', async () => {
      const currentVenue = makeVenue();
      const newAddress = makeAddress({ id: 'addr-2' });
      const nextVenue = makeVenue({
        id: 'venue-2',
        addressId: 'addr-2',
        active: true,
      });
      const nextWithAddress = { ...nextVenue, address: newAddress };

      venueRepository.findById
        .mockResolvedValueOnce({ ...currentVenue, address: makeAddress() })
        .mockResolvedValueOnce(nextWithAddress);
      addressService.findById.mockResolvedValue(newAddress);
      venueRepository.findByNameCapacityAndAddress.mockResolvedValue(undefined);
      venueRepository.create.mockResolvedValue(nextVenue);
      venueRepository.update.mockResolvedValue({
        ...currentVenue,
        active: false,
      });

      const result = await service.update('venue-1', { addressId: 'addr-2' });

      expect(addressService.findById).toHaveBeenCalledWith('addr-2', tx);
      expect(venueRepository.create).toHaveBeenCalledWith(
        {
          name: 'Auditório A',
          maxCapacity: 100,
          addressId: 'addr-2',
          active: true,
        },
        tx,
      );
      expect(venueRepository.update).toHaveBeenCalledWith(
        'venue-1',
        { active: false },
        tx,
      );
      expect(result).toEqual(nextWithAddress);
    });

    it.each([undefined, null, '', 'Sala 3'])(
      'completa atualização parcial e preserva o endereço original (complement: %j)',
      async (complement) => {
        const currentAddress = makeAddress({
          complement: 'Sala 2',
          country: 'Portugal',
        });
        const original = { ...currentAddress };
        const nextVenue = makeVenue({ id: 'venue-2', addressId: 'addr-2' });
        const nextWithAddress = {
          ...nextVenue,
          address: makeAddress({ id: 'addr-2' }),
        };
        venueRepository.findById
          .mockResolvedValueOnce({ ...makeVenue(), address: currentAddress })
          .mockResolvedValueOnce(nextWithAddress);
        addressService.create.mockResolvedValue(makeAddress({ id: 'addr-2' }));
        venueRepository.create.mockResolvedValue(nextVenue);

        const result = await service.update('venue-1', {
          address: { city: 'Olinda', complement },
        });

        expect(addressService.create).toHaveBeenCalledWith(
          {
            zipCode: '50000-000',
            street: 'Rua Teste',
            number: '100',
            complement: complement === undefined ? 'Sala 2' : complement,
            neighborhood: 'Centro',
            city: 'Olinda',
            state: 'PE',
            country: 'Portugal',
          },
          tx,
        );
        expect(currentAddress).toEqual(original);
        expect(addressService.update).not.toHaveBeenCalled();
        expect(venueRepository.update).toHaveBeenCalledWith(
          'venue-1',
          { active: false },
          tx,
        );
        expect(result).toEqual(nextWithAddress);
      },
    );

    it('atualiza endereço sem complemento e reutiliza um local equivalente', async () => {
      const existing = makeVenue({ id: 'venue-2', addressId: 'addr-2' });
      const existingWithAddress = {
        ...existing,
        address: makeAddress({ id: 'addr-2', city: 'Olinda' }),
      };
      venueRepository.findById
        .mockResolvedValueOnce({ ...makeVenue(), address: makeAddress() })
        .mockResolvedValueOnce(existingWithAddress);
      addressService.create.mockResolvedValue(
        makeAddress({ id: 'addr-2', city: 'Olinda' }),
      );
      venueRepository.findByNameCapacityAndAddress.mockResolvedValue(existing);

      await expect(
        service.update('venue-1', { address: { city: 'Olinda' } }),
      ).resolves.toEqual(existingWithAddress);
      expect(addressService.create).toHaveBeenCalledWith(
        expect.objectContaining({ complement: null, country: 'Brasil' }),
        tx,
      );
      expect(venueRepository.create).not.toHaveBeenCalled();
      expect(venueRepository.update).toHaveBeenCalledWith(
        'venue-1',
        { active: false },
        tx,
      );
    });

    it.each([{}, { city: 'Recife' }])(
      'mantém o local quando o endereço não muda: %j',
      async (address) => {
        const current = makeVenue();
        const currentWithAddress = { ...current, address: makeAddress() };
        venueRepository.findById
          .mockResolvedValueOnce({ ...current, address: makeAddress() })
          .mockResolvedValueOnce(currentWithAddress);
        venueRepository.update.mockResolvedValue(current);

        await expect(service.update('venue-1', { address })).resolves.toEqual(
          currentWithAddress,
        );
        expect(addressService.create).not.toHaveBeenCalled();
        expect(addressService.update).not.toHaveBeenCalled();
        expect(venueRepository.create).not.toHaveBeenCalled();
        expect(venueRepository.update).not.toHaveBeenCalledWith(
          'venue-1',
          { active: false },
          tx,
        );
      },
    );
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

      expect(venueRepository.hasUpcomingEvents).toHaveBeenCalledWith('venue-1');
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
      venueRepository.hasUpcomingEvents.mockResolvedValue(true);

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
