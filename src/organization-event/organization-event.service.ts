import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventService } from '../event/event.service';
import { OrganizationService } from '../organization/organization.service';
import { CreateOrganizationEventDto } from './dto/create-organization-event.dto';
import { OrganizationEventRepository } from './organization-event.repository';

@Injectable()
export class OrganizationEventService {
  constructor(
    private readonly organizationEventRepository: OrganizationEventRepository,
    private readonly eventService: EventService,
    private readonly organizationService: OrganizationService,
  ) {}

  async findAll(eventId: string) {
    await this.eventService.findOne(eventId);
    return this.organizationEventRepository.findAllByEvent(eventId);
  }

  async create(eventId: string, dto: CreateOrganizationEventDto) {
    await this.eventService.findOne(eventId);
    await this.ensureOrganizationExists(dto.organizationId);

    const existing = await this.organizationEventRepository.findOne(
      eventId,
      dto.organizationId,
    );
    if (existing) {
      throw new ConflictException(
        `Organização ${dto.organizationId} já está vinculada ao evento ${eventId}`,
      );
    }

    return this.organizationEventRepository.create({
      eventId,
      organizationId: dto.organizationId,
      role: dto.role,
    });
  }

  async remove(eventId: string, organizationId: string): Promise<void> {
    const existing = await this.organizationEventRepository.findOne(
      eventId,
      organizationId,
    );
    if (!existing) {
      throw new NotFoundException(
        `Organização ${organizationId} não está vinculada ao evento ${eventId}`,
      );
    }

    await this.organizationEventRepository.delete(eventId, organizationId);
  }

  private async ensureOrganizationExists(
    organizationId: string,
  ): Promise<void> {
    try {
      await this.organizationService.findOne(organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Organização ${organizationId} não encontrada`,
        );
      }
      throw error;
    }
  }
}
