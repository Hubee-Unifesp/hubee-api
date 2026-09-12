import { Injectable } from '@nestjs/common';
import { AddressRepository } from './address.repository';
import type { DbExecutor } from '../database/database.provider';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  create(dto: CreateAddressDto, executor?: DbExecutor) {
    return this.addressRepository.create(dto, executor);
  }

  findById(id: string, executor?: DbExecutor) {
    return this.addressRepository.findById(id, executor);
  }

  update(id: string, dto: UpdateAddressDto, executor?: DbExecutor) {
    return this.addressRepository.update(id, dto, executor);
  }
}
