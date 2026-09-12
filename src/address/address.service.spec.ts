import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressRepository } from './address.repository';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

function makeAddress(
  overrides: Partial<Awaited<ReturnType<AddressRepository['create']>>> = {},
) {
  return {
    id: '1',
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

describe('AddressService', () => {
  let service: AddressService;
  let repository: {
    create: jest.Mock<AddressRepository['create']>;
    findById: jest.Mock<AddressRepository['findById']>;
    update: jest.Mock<AddressRepository['update']>;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn<AddressRepository['create']>(),
      findById: jest.fn<AddressRepository['findById']>(),
      update: jest.fn<AddressRepository['update']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: AddressRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(AddressService);
  });

  it('repassa create() para o repository', async () => {
    const dto = { city: 'Recife' } as CreateAddressDto;
    const address = makeAddress();
    repository.create.mockResolvedValue(address);

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith(dto, undefined);
    expect(result).toEqual(address);
  });

  it('repassa findById() para o repository, incluindo o executor', async () => {
    const executor = {} as never;
    const address = makeAddress();
    repository.findById.mockResolvedValue(address);

    const result = await service.findById('1', executor);

    expect(repository.findById).toHaveBeenCalledWith('1', executor);
    expect(result).toEqual(address);
  });

  it('repassa update() para o repository', async () => {
    const dto: UpdateAddressDto = { city: 'Olinda' };
    const address = makeAddress({ city: 'Olinda' });
    repository.update.mockResolvedValue(address);

    const result = await service.update('1', dto);

    expect(repository.update).toHaveBeenCalledWith('1', dto, undefined);
    expect(result).toEqual(address);
  });
});
