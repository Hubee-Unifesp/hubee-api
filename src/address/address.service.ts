import { Injectable } from '@nestjs/common';
import { AddressRepository } from './address.repository';
import type { DbExecutor } from '../database/database.provider';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  async create(dto: CreateAddressDto, executor?: DbExecutor) {
    const existing =
      await this.addressRepository.findByZipCodeNumberAndComplement(
        dto.zipCode,
        dto.number,
        dto.complement ?? null,
        executor,
      );

    if (existing) {
      return existing;
    }

    return this.addressRepository.create(dto, executor);
  }

  findById(id: string, executor?: DbExecutor) {
    return this.addressRepository.findById(id, executor);
  }

  update(id: string, dto: UpdateAddressDto, executor?: DbExecutor) {
    return this.addressRepository.update(id, dto, executor);
  }
}
