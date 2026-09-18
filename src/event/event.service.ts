import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import { VenueService } from '../venue/venue.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventRepository, FindAllEventsFilters } from './event.repository';

interface EventPeriod {
  startDate: Date;
  endDate: Date;
  salesStartDate?: Date | null;
}

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly organizationService: OrganizationService,
    private readonly venueService: VenueService,
  ) {}

  findAll(filters: FindAllEventsFilters) {
    return this.eventRepository.findAll(filters);
  }

  async findOne(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundException(`Evento ${id} não encontrado`);
    }
    return event;
  }

  async create(dto: CreateEventDto) {
    this.validatePeriod(dto);
    await this.ensureOrganizerExists(dto.organizerId);
    await this.ensureVenueExists(dto.venueId);

    return this.eventRepository.create(dto);
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.findOne(id);

    if (event.status === 'cancelled') {
      throw new UnprocessableEntityException(
        'Evento cancelado não pode ser alterado',
      );
    }

    this.validatePeriod({
      startDate: dto.startDate ?? event.startDate,
      endDate: dto.endDate ?? event.endDate,
      salesStartDate: dto.salesStartDate ?? event.salesStartDate,
    });

    if (dto.venueId && dto.venueId !== event.venueId) {
      await this.ensureVenueExists(dto.venueId);
    }

    return this.eventRepository.update(id, dto);
  }

  async cancel(id: string): Promise<void> {
    const event = await this.findOne(id);

    if (event.status === 'cancelled') {
      throw new UnprocessableEntityException('Evento já está cancelado');
    }

    await this.eventRepository.update(id, { status: 'cancelled' });
  }

  private validatePeriod(period: EventPeriod): void {
    if (period.endDate <= period.startDate) {
      throw new BadRequestException(
        'A data de término deve ser posterior à data de início',
      );
    }

    if (period.salesStartDate && period.salesStartDate > period.startDate) {
      throw new BadRequestException(
        'A data de início das vendas não pode ser posterior ao início do evento',
      );
    }
  }

  private async ensureOrganizerExists(organizerId: string): Promise<void> {
    try {
      await this.organizationService.findOne(organizerId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Organização ${organizerId} não encontrada`,
        );
      }
      throw error;
    }
  }

  private async ensureVenueExists(venueId: string): Promise<void> {
    try {
      await this.venueService.findOne(venueId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Local ${venueId} não encontrado`);
      }
      throw error;
    }
  }
}
