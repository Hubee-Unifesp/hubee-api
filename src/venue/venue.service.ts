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
          venue.addressId,
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
      const {
        zipCode,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        country,
      } = dto.address;

      if (
        !zipCode ||
        !street ||
        !number ||
        !complement ||
        !neighborhood ||
        !city ||
        !state ||
        !country
      ) {
        throw new BadRequestException(
          'Para criar um novo endereço, informe todos os campos: zipCode, street, number, complement, neighborhood, city, state e country.',
        );
      }

      const created = await this.addressService.create(
        {
          zipCode,
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          country,
        },
        tx,
      );

      return created.id;
    }

    return currentAddressId;
  }

  // TODO: substituir por consulta real assim que a entidade Evento
  // existir (ex: SELECT 1 FROM events WHERE venue_id = :id AND starts_at > now()).
  private async checkUpcomingEvents(_venueId: string): Promise<boolean> {
    return false;
  }
}
