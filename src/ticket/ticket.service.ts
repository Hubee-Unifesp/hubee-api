import { randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TicketStatus } from '../database/schema';
import { EventService } from '../event/event.service';
import { OrderService } from '../order/order.service';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreateTicketsDto } from './dto/create-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketRepository } from './ticket.repository';

/**
 * Transições permitidas. `usado` e `cancelado` são finais: um ingresso já
 * lido na portaria não volta a valer, e um cancelado não é reativado.
 */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  emitido: ['usado', 'cancelado'],
  usado: [],
  cancelado: [],
};

@Injectable()
export class TicketService {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly orderService: OrderService,
    private readonly eventService: EventService,
    private readonly ticketTypeService: TicketTypeService,
    private readonly usuariosService: UsuariosService,
  ) {}

  /** Consulta o pedido antes para que um pedido inexistente dê 404, e não `[]`. */
  async findAllByOrder(orderId: string) {
    await this.orderService.findOne(orderId);
    return this.ticketRepository.findAllByOrder(orderId);
  }

  async findOne(id: string) {
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Ingresso ${id} não encontrado`);
    }
    return ticket;
  }

  async create(orderId: string, dto: CreateTicketsDto) {
    const order = await this.orderService.findOne(orderId);
    if (order.status !== 'pago') {
      throw new UnprocessableEntityException(
        'Só pedidos pagos podem ter ingressos emitidos',
      );
    }

    // Toda a validação roda antes do INSERT: um item inválido derruba o lote
    // inteiro, sem deixar ingressos emitidos pela metade.
    await this.ensureEventsAcceptTickets(dto);
    await this.ensureTicketTypesBelongToEvents(dto);
    const holderUserIds = dto.tickets.map(
      (item) => item.holderUserId ?? order.userId,
    );
    await this.ensureUsersExist(holderUserIds);

    return this.ticketRepository.createMany(
      dto.tickets.map((item, index) => ({
        orderId,
        eventId: item.eventId,
        ticketTypeId: item.ticketTypeId,
        holderUserId: holderUserIds[index],
        qrCode: randomUUID(),
      })),
    );
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.findOne(id);

    if (!ALLOWED_TRANSITIONS[ticket.status].includes(dto.status)) {
      throw new UnprocessableEntityException(
        `Ingresso ${ticket.status} não pode passar para ${dto.status}`,
      );
    }

    const updated = await this.ticketRepository.updateStatus(
      id,
      ticket.status,
      dto.status,
    );
    if (!updated) {
      throw new UnprocessableEntityException(
        'O status do ingresso foi alterado por outra requisição',
      );
    }
    return updated;
  }

  /** Evento cancelado não vende ingresso, na mesma regra de `EventService.update`. */
  private async ensureEventsAcceptTickets(dto: CreateTicketsDto) {
    for (const eventId of new Set(dto.tickets.map((item) => item.eventId))) {
      const event = await this.eventService.findOne(eventId);
      if (event.status === 'cancelled') {
        throw new UnprocessableEntityException(
          'Evento cancelado não pode ter ingressos emitidos',
        );
      }
    }
  }

  /**
   * O tipo de ingresso já pertence a um evento; o `eventId` do item precisa
   * bater com ele. `TicketTypeService.findOne` filtra por evento, então um
   * tipo de outro evento responde 404 como se não existisse.
   */
  private async ensureTicketTypesBelongToEvents(dto: CreateTicketsDto) {
    const pairs = new Map(
      dto.tickets.map((item) => [`${item.eventId}:${item.ticketTypeId}`, item]),
    );
    for (const { eventId, ticketTypeId } of pairs.values()) {
      await this.ticketTypeService.findOne(eventId, ticketTypeId);
    }
  }

  /**
   * A FK garante que o titular existe, mas só na hora do INSERT: sem esta
   * checagem o erro do Postgres subiria como 500 em vez de 404. Também barra
   * usuários removidos logicamente, que a FK aceitaria.
   */
  private async ensureUsersExist(userIds: string[]) {
    for (const userId of new Set(userIds)) {
      try {
        await this.usuariosService.findOne(userId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(`Usuário ${userId} não encontrado`);
        }
        throw error;
      }
    }
  }
}
