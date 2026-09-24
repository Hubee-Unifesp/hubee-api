import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AddressService } from '../address/address.service';
import type { addresses } from '../database/schema';
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
      const existing = await this.venueRepository.findByNameCapacityAndAddress(
        dto.name,
        dto.maxCapacity,
        addressId,
        tx,
      );

      if (existing) {
        return existing;
      }

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

      const hasAddressChange =
        dto.addressId !== undefined || dto.address !== undefined;

      if (hasAddressChange) {
        const addressId = await this.resolveAddressForUpdate(
          venue.address,
          dto,
          tx,
        );

        const existing =
          await this.venueRepository.findByNameCapacityAndAddress(
            dto.name ?? venue.name,
            dto.maxCapacity ?? venue.maxCapacity,
            addressId,
            tx,
          );

        if (existing && existing.id !== id && dto.active !== false) {
          await this.venueRepository.update(id, { active: false }, tx);
          return existing;
        }

        if (addressId === venue.addressId) {
          return this.venueRepository.update(
            id,
            {
              name: dto.name,
              maxCapacity: dto.maxCapacity,
              active: dto.active,
            },
            tx,
          );
        }

        const newVenue = await this.venueRepository.create(
          {
            name: dto.name ?? venue.name,
            maxCapacity: dto.maxCapacity ?? venue.maxCapacity,
            addressId,
            active: dto.active ?? true,
          },
          tx,
        );

        await this.venueRepository.update(id, { active: false }, tx);

        return newVenue;
      }

      const updatedVenue = await this.venueRepository.update(
        id,
        {
          name: dto.name,
          maxCapacity: dto.maxCapacity,
          active: dto.active,
        },
        tx,
      );

      return updatedVenue;
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
    if (dto.address) {
      const created = await this.addressService.create(dto.address, tx);
      return created.id;
    }

    if (dto.addressId) {
      const existing = await this.addressService.findById(dto.addressId, tx);
      if (!existing) {
        throw new NotFoundException(`Endereço ${dto.addressId} não encontrado`);
      }
      return dto.addressId;
    }

    throw new BadRequestException(
      'Informe "addressId" de um endereço existente ou "address" para criar um novo',
    );
  }

  private async resolveAddressForUpdate(
    currentAddress: typeof addresses.$inferSelect,
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
      const changes = dto.address;
      const data = {
        zipCode: changes.zipCode ?? currentAddress.zipCode,
        street: changes.street ?? currentAddress.street,
        number: changes.number ?? currentAddress.number,
        complement:
          changes.complement === undefined
            ? currentAddress.complement
            : changes.complement,
        neighborhood: changes.neighborhood ?? currentAddress.neighborhood,
        city: changes.city ?? currentAddress.city,
        state: changes.state ?? currentAddress.state,
        country: changes.country ?? currentAddress.country,
      };

      if (
        (Object.keys(data) as Array<keyof typeof data>).every(
          (key) => data[key] === currentAddress[key],
        )
      ) {
        return currentAddress.id;
      }

      const created = await this.addressService.create(data, tx);

      return created.id;
    }

    return currentAddress.id;
  }

  // TODO: substituir por consulta real assim que a entidade Evento
  // existir (ex: SELECT 1 FROM events WHERE venue_id = :id AND starts_at > now()).
  private async checkUpcomingEvents(_venueId: string): Promise<boolean> {
    return false;
  }
}
