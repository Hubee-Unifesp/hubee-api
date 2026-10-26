import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { effectiveLevel, satisfiesLevel } from '../auth/org-access-level';
import { OrganizationService } from '../organization/organization.service';
import { VenueService } from '../venue/venue.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  QueryEventDto,
} from './dto/query-event.dto';
import { EventRepository } from './event.repository';

interface EventPeriod {
  startDate: Date;
  endDate: Date;
  salesStartDate?: Date | null;
}

const isAdmin = (viewer?: AuthenticatedUser) => viewer?.role === 'ADMIN';

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly organizationService: OrganizationService,
    private readonly venueService: VenueService,
  ) {}

  /**
   * Visitante e USER só veem eventos publicados: o filtro `status` da query
   * é ignorado e trocado por `published`. ADMIN filtra por qualquer status, e
   * o membro da organização também, quando filtra por ela (`organizerId`),
   * para ver os rascunhos dos próprios eventos.
   */
  async findAll(query: QueryEventDto, viewer?: AuthenticatedUser) {
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, ...filters } = query;

    if (
      filters.startDate &&
      filters.endDate &&
      filters.endDate < filters.startDate
    ) {
      throw new BadRequestException(
        'A data final deve ser igual ou posterior à data inicial',
      );
    }

    const seesAll =
      isAdmin(viewer) ||
      (filters.organizerId !== undefined &&
        (await this.isMember(viewer, filters.organizerId)));
    const visible = seesAll
      ? filters
      : { ...filters, status: 'published' as const };
    const { data, total } = await this.eventRepository.findAll(visible, {
      page,
      limit,
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  findUpcomingSummaries() {
    return this.eventRepository.findUpcomingSummaries();
  }

  async findOne(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundException(`Evento ${id} não encontrado`);
    }
    return event;
  }

  /**
   * Versão pública de `findOne`: rascunho, encerrado ou cancelado responde
   * 404, como se o evento não existisse, para quem não é ADMIN nem membro da
   * organização do evento.
   */
  async findVisible(id: string, viewer?: AuthenticatedUser) {
    const event = await this.findOne(id);
    if (
      event.status !== 'published' &&
      !isAdmin(viewer) &&
      !(await this.isMember(viewer, event.organizerId))
    ) {
      throw new NotFoundException(`Evento ${id} não encontrado`);
    }
    return event;
  }

  /**
   * Quem pode criar (ADMIN ou membro com `write` na organização) é conferido
   * pelo `@OrgAccess` no controller.
   */
  async create(dto: CreateEventDto, actor: AuthenticatedUser) {
    this.ensureCanFeature(dto, actor);
    this.validatePeriod(dto);
    await this.ensureOrganizerExists(dto.organizerId);
    await this.ensureVenueExists(dto.venueId);

    return this.eventRepository.create(dto);
  }

  /**
   * Que o evento é da organização do usuário é conferido pelo `@OrgAccess` no
   * controller (evento de outra organização responde 404). Cancelar pelo
   * `PATCH` (`status: 'cancelled'`) segue a regra do `DELETE`.
   */
  async update(id: string, dto: UpdateEventDto, actor: AuthenticatedUser) {
    this.ensureCanFeature(dto, actor);
    const event = await this.findOne(id);

    if (event.status === 'cancelled') {
      throw new UnprocessableEntityException(
        'Evento cancelado não pode ser alterado',
      );
    }

    if (dto.status === 'cancelled') {
      await this.ensureCanCancel(actor, event.organizerId);
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

  /** Membro com convite aceito (qualquer nível) da organização. */
  private async isMember(
    viewer: AuthenticatedUser | undefined,
    organizationId: string,
  ): Promise<boolean> {
    if (!viewer) return false;
    return Boolean(
      await this.eventRepository.findMembership(viewer.id, organizationId),
    );
  }

  /**
   * Cancelar evento é só do ADMIN ou do administrador da organização
   * (`manage`), pela matriz RBAC (GOL-143).
   */
  private async ensureCanCancel(
    actor: AuthenticatedUser,
    organizationId: string,
  ): Promise<void> {
    if (isAdmin(actor)) return;
    const membership = await this.eventRepository.findMembership(
      actor.id,
      organizationId,
    );
    if (!membership || !satisfiesLevel(effectiveLevel(membership), 'manage')) {
      throw new ForbiddenException(
        'Apenas administradores da organização podem cancelar o evento',
      );
    }
  }

  /** O destaque na home (`featured`) é curadoria da plataforma: só ADMIN. */
  private ensureCanFeature(
    dto: { featured?: boolean },
    actor: AuthenticatedUser,
  ): void {
    if (dto.featured !== undefined && !isAdmin(actor)) {
      throw new ForbiddenException(
        'Apenas administradores podem destacar eventos na página inicial',
      );
    }
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
