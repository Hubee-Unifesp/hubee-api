import { randomBytes, randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { canAccess } from '../auth/ownership';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import type { TicketStatus, orders } from '../database/schema';
import { EventService } from '../event/event.service';
import { OrderService } from '../order/order.service';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsersService } from '../users/users.service';
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

/** Item de pedido com o lote junto, de onde sai o evento do ingresso. */
interface IssuableItem {
  ticketTypeId: string;
  quantity: number;
  ticketType: { eventId: string };
}

/** 256 bits aleatórios em hexadecimal (64 caracteres, o tamanho da coluna). */
function generateQrCode(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class TicketService {
  constructor(
    // A emissão manual trava os lotes e insere na mesma transaction para não
    // permitir overselling (GOL-216). A regra de estoque em si vive no
    // `OrderService`, compartilhada com a compra.
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly ticketRepository: TicketRepository,
    private readonly orderService: OrderService,
    private readonly eventService: EventService,
    private readonly ticketTypeService: TicketTypeService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Consulta o pedido antes para que um pedido inexistente dê 404, e não `[]`.
   * Pedido de outra pessoa também dá 404, para não revelar quais ids existem.
   */
  async findAllByOrder(orderId: string, user: AuthenticatedUser) {
    const order = await this.orderService.findById(orderId);
    if (!canAccess(user, order.userId)) {
      throw new NotFoundException(`Pedido ${orderId} não encontrado`);
    }
    return this.ticketRepository.findAllByOrder(orderId);
  }

  /** O titular e o comprador do pedido veem o ingresso; os demais recebem 404. */
  async findOne(id: string, user: AuthenticatedUser) {
    const ticket = await this.findById(id);
    if (canAccess(user, ticket.holderUserId)) return ticket;

    const order = await this.orderService.findById(ticket.orderId);
    if (!canAccess(user, order.userId)) {
      throw new NotFoundException(`Ingresso ${id} não encontrado`);
    }
    return ticket;
  }

  async create(orderId: string, dto: CreateTicketsDto) {
    const order = await this.orderService.findById(orderId);
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

    // A checagem de estoque e o INSERT correm na mesma transaction: o
    // `OrderService` trava cada lote (`FOR UPDATE`) e confere a capacidade; se
    // algum estourar, a exception (422) aborta tudo e nada é emitido.
    return this.db.transaction(async (tx) => {
      await this.orderService.assertBatchesHaveStock(
        this.countRequestedByType(dto),
        tx,
      );
      return this.ticketRepository.createMany(
        dto.tickets.map((item, index) => ({
          orderId,
          eventId: item.eventId,
          ticketTypeId: item.ticketTypeId,
          holderUserId: holderUserIds[index],
          qrCode: randomUUID(),
        })),
        tx,
      );
    });
  }

  /** Soma os ingressos pedidos por lote, para conferir o saldo uma vez só. */
  private countRequestedByType(dto: CreateTicketsDto) {
    const quantities = new Map<string, number>();
    for (const { ticketTypeId } of dto.tickets) {
      quantities.set(ticketTypeId, (quantities.get(ticketTypeId) ?? 0) + 1);
    }
    return [...quantities].map(([ticketTypeId, quantity]) => ({
      ticketTypeId,
      quantity,
    }));
  }

  /**
   * Emite os ingressos de um pedido que acabou de ser pago, um por unidade
   * comprada, com o comprador como titular. Recebe o executor da transaction
   * do checkout: se qualquer INSERT falhar, o pagamento também é desfeito.
   */
  async issueForPaidOrder(
    order: Pick<typeof orders.$inferSelect, 'id' | 'userId' | 'status'>,
    items: IssuableItem[],
    executor: DbExecutor,
  ) {
    if (order.status !== 'pago') {
      throw new UnprocessableEntityException(
        'Só pedidos pagos podem ter ingressos emitidos',
      );
    }

    return this.ticketRepository.createMany(
      items.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          orderId: order.id,
          eventId: item.ticketType.eventId,
          ticketTypeId: item.ticketTypeId,
          holderUserId: order.userId,
          qrCode: generateQrCode(),
        })),
      ),
      executor,
    );
  }

  /** Só os ingressos em que o usuário é titular, mesmo para ADMIN. */
  findAllByHolder(userId: string) {
    return this.ticketRepository.findAllByHolder(userId);
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.findById(id);

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

  private async findById(id: string) {
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Ingresso ${id} não encontrado`);
    }
    return ticket;
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
        await this.usersService.findOne(userId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(`Usuário ${userId} não encontrado`);
        }
        throw error;
      }
    }
  }
}
