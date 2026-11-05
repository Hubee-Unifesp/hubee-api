import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { DbExecutor } from '../database/database.provider';
import { EventService } from '../event/event.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeRepository } from './ticket-type.repository';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class TicketTypeService {
  constructor(
    private readonly ticketTypeRepository: TicketTypeRepository,
    private readonly eventService: EventService,
  ) {}

  /** Consulta o evento visível para que rascunhos sem permissão e eventos inexistentes dêem 404. */
  async findAll(eventId: string, viewer?: AuthenticatedUser) {
    await this.eventService.findVisible(eventId, viewer);
    return this.ticketTypeRepository.findAll(eventId);
  }

  /** Versão pública de findOne: rascunho sem permissão responde 404. */
  async findVisible(eventId: string, id: string, viewer?: AuthenticatedUser) {
    await this.eventService.findVisible(eventId, viewer);
    return this.findTicketTypeOfEvent(eventId, id);
  }

  /** Uso interno: confere se o lote pertence ao evento sem checar visibilidade de rascunho. */
  async findOne(eventId: string, id: string) {
    await this.eventService.findOne(eventId);
    return this.findTicketTypeOfEvent(eventId, id);
  }

  /**
   * Lotes de qualquer evento, travados para a compra. Só faz sentido dentro de
   * uma transaction, que é quem solta a trava.
   */
  lockForPurchase(ids: string[], executor: DbExecutor) {
    return this.ticketTypeRepository.findManyForPurchase(ids, executor);
  }

  async create(eventId: string, dto: CreateTicketTypeDto) {
    await this.eventService.findOne(eventId);
    return this.ticketTypeRepository.create({ ...dto, eventId });
  }

  async update(eventId: string, id: string, dto: UpdateTicketTypeDto) {
    await this.eventService.findOne(eventId);
    await this.findTicketTypeOfEvent(eventId, id);

    if (dto.quantity !== undefined) {
      const committed = await this.ticketTypeRepository.countCommitted(id);
      if (dto.quantity < committed) {
        throw new UnprocessableEntityException(
          'A capacidade do lote não pode ser menor do que a quantidade já reservada ou vendida.',
        );
      }
    }

    return this.ticketTypeRepository.update(eventId, id, dto);
  }

  async remove(eventId: string, id: string): Promise<void> {
    await this.eventService.findOne(eventId);
    await this.findTicketTypeOfEvent(eventId, id);

    const hasLinkedRecords =
      await this.ticketTypeRepository.hasLinkedTicketsOrOrders(id);
    if (hasLinkedRecords) {
      throw new ConflictException(
        'Não é possível excluir um lote que já possui ingressos ou pedidos vinculados.',
      );
    }

    try {
      await this.ticketTypeRepository.delete(eventId, id);
    } catch (error: unknown) {
      const pgCode =
        typeof error === 'object' && error !== null
          ? ((error as { code?: string; cause?: { code?: string } }).code ??
            (error as { cause?: { code?: string } }).cause?.code)
          : undefined;
      if (pgCode === '23503') {
        throw new ConflictException(
          'Não é possível excluir um lote que já possui ingressos ou pedidos vinculados.',
        );
      }
      throw error;
    }
  }

  private async findTicketTypeOfEvent(eventId: string, id: string) {
    const ticketType = await this.ticketTypeRepository.findById(eventId, id);
    if (!ticketType) {
      throw new NotFoundException(`Tipo de ingresso ${id} não encontrado`);
    }
    return ticketType;
  }
}
