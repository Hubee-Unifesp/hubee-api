import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AddressService } from '../address/address.service';
import { DRIZZLE } from '../database/database.constants';
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from '../database/database.provider';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindAllVenuesFilters, VenueRepository } from './venue.repository';

@Injectable()
export class VenueService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly venueRepository: VenueRepository,
    private readonly addressService: AddressService,
  ) {}

  async findAll(filters: FindAllVenuesFilters) {
    const rows = await this.venueRepository.findAll(filters);
    return rows.map(({ venue, address }) => ({ ...venue, address }));
  }

  async findOne(id: string) {
    const venue = await this.venueRepository.findById(id);
    if (!venue) {
      throw new NotFoundException(`Local ${id} não encontrado`);
    }
    return venue;
  }

  async create(dto: CreateVenueDto) {
    return this.db.transaction(async (tx) => {
      const addressId = await this.resolveAddressForCreate(dto, tx);

      return this.venueRepository.create(
        { name: dto.name, maxCapacity: dto.maxCapacity, addressId },
        tx,
      );
    });
  }

  async update(id: string, dto: UpdateVenueDto) {
    return this.db.transaction(async (tx) => {
      const venue = await this.venueRepository.findById(id, tx);
      if (!venue) {
        throw new NotFoundException(`Local ${id} não encontrado`);
      }

      const addressId = await this.resolveAddressForUpdate(
        venue.addressId,
        dto,
        tx,
      );

      return this.venueRepository.update(
        id,
        { name: dto.name, maxCapacity: dto.maxCapacity, addressId },
        tx,
      );
    });
  }

  async remove(id: string): Promise<void> {
    const venue = await this.venueRepository.findById(id);
    if (!venue) {
      throw new NotFoundException(`Local ${id} não encontrado`);
    }

    const hasUpcomingEvents = await this.checkUpcomingEvents(id);
    if (hasUpcomingEvents) {
      throw new ConflictException(
        'Local possui eventos futuros vinculados e não pode ser excluído',
      );
    }

    await this.venueRepository.delete(id);
  }

  private async resolveAddressForCreate(
    dto: CreateVenueDto,
    tx: DrizzleTransaction,
  ): Promise<string> {
    if (dto.addressId) {
      const existing = await this.addressService.findById(dto.addressId, tx);
      if (!existing) {
        throw new NotFoundException(`Endereço ${dto.addressId} não encontrado`);
      }
      return dto.addressId;
    }

    if (dto.address) {
      const created = await this.addressService.create(dto.address, tx);
      return created.id;
    }

    throw new BadRequestException(
      'Informe "addressId" de um endereço existente ou "address" para criar um novo',
    );
  }

  private async resolveAddressForUpdate(
    currentAddressId: string,
    dto: UpdateVenueDto,
    tx: DrizzleTransaction,
  ): Promise<string> {
    if (dto.addressId) {
      const existing = await this.addressService.findById(dto.addressId, tx);
      if (!existing) {
        throw new NotFoundException(`Endereço ${dto.addressId} não encontrado`);
      }
      return dto.addressId;
    }

    if (dto.address) {
      await this.addressService.update(currentAddressId, dto.address, tx);
    }

    return currentAddressId;
  }

  // TODO: substituir por consulta real assim que a entidade Evento
  // existir (ex: SELECT 1 FROM events WHERE venue_id = :id AND starts_at > now()).
  private async checkUpcomingEvents(_venueId: string): Promise<boolean> {
    return false;
  }
}
