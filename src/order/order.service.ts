import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { canAccess } from '../auth/ownership';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderItemRepository } from './order-item.repository';
import { isReservationExpired } from './order-reservation';
import { FindAllOrdersFilters, OrderRepository } from './order.repository';
import type { OrderStatus } from '../database/schema';

/**
 * Trocas de status aceitas no `PATCH /orders/:id`. `pago` nunca é destino
 * manual: só o checkout paga, porque é ele que registra o pagamento e emite os
 * ingressos. Pedido pago também não pode ser cancelado aqui, senão os
 * ingressos continuariam `emitido` enquanto a vaga volta ao lote; o caminho
 * para desfazer uma compra paga é o estorno.
 */
const MANUAL_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pendente: ['cancelado'],
  pago: [],
  cancelado: [],
};

@Injectable()
export class OrderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly usersService: UsersService,
    private readonly ticketTypeService: TicketTypeService,
  ) {}

  findAll(filters: FindAllOrdersFilters) {
    return this.orderRepository.findAll(filters);
  }

  async findById(id: string) {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
    return order;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const order = await this.ensureAccessible(id, user);
    const items = await this.orderItemRepository.findByOrder(id);
    return { ...order, items };
  }

  async create(authUser: AuthenticatedUser, dto: CreateOrderDto) {
    await this.usersService.findOne(authUser.id);

    return this.placeOrder(authUser.id, dto);
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas administradores podem alterar pedidos',
      );
    }

    // O pedido fica travado até o fim da transaction: um checkout ao mesmo
    // tempo espera, e a regra abaixo sempre enxerga o status atual.
    return this.db.transaction(async (tx) => {
      const order = await this.lockAccessible(id, user, tx);
      if (order.status === 'cancelado') {
        throw new UnprocessableEntityException(
          'Pedido cancelado não pode ser alterado',
        );
      }

      const target = dto.status;
      if (target === undefined || target === order.status) {
        return order;
      }

      assertManualTransition(order.status, target);
      return this.orderRepository.update(id, { status: target }, tx);
    });
  }

  /**
   * Cancela o pedido do usuário. Trava o pedido antes de conferir o status
   * para não cancelar um pedido que um checkout simultâneo acabou de pagar.
   */
  async cancel(id: string, user: AuthenticatedUser): Promise<void> {
    await this.db.transaction(async (tx) => {
      const order = await this.lockAccessible(id, user, tx);

      if (order.status === 'cancelado') {
        throw new UnprocessableEntityException('Pedido já está cancelado');
      }

      if (order.status === 'pago') {
        throw new UnprocessableEntityException(
          'Pedido pago não pode ser cancelado; registre um estorno',
        );
      }

      await this.orderRepository.update(id, { status: 'cancelado' }, tx);
    });
  }

  /**
   * Para o checkout: trava o pedido até o fim da transaction e só o devolve se
   * for do usuário e ainda estiver pendente. Pedido de outra pessoa responde
   * 404, igual a pedido inexistente.
   */
  async lockPendingForCheckout(
    id: string,
    user: AuthenticatedUser,
    executor: DbExecutor,
  ) {
    const order = await this.lockAccessible(id, user, executor);
    if (order.status === 'pago') {
      throw new UnprocessableEntityException('Pedido já foi pago');
    }
    if (order.status === 'cancelado') {
      throw new UnprocessableEntityException(
        'Pedido cancelado não pode ser pago',
      );
    }
    return order;
  }

  /**
   * Pedido pendente cuja reserva já venceu vira `cancelado` (devolvendo a vaga
   * de vez) e não pode mais ser pago. Devolve `true` quando cancelou.
   */
  async cancelIfReservationExpired(
    order: { id: string; status: string; createdAt: Date },
    executor: DbExecutor,
    now: Date = new Date(),
  ): Promise<boolean> {
    if (!isReservationExpired(order, now)) return false;
    await this.orderRepository.update(
      order.id,
      { status: 'cancelado' },
      executor,
    );
    return true;
  }

  findItems(orderId: string, executor: DbExecutor) {
    return this.orderItemRepository.findByOrder(orderId, executor);
  }

  markAsPaid(id: string, executor: DbExecutor) {
    return this.orderRepository.update(id, { status: 'pago' }, executor);
  }

  /**
   * Trava os lotes pedidos (`FOR UPDATE`), confere o saldo disponível
   * (`capacidade - reservado`) e lança 422 no primeiro lote sem vaga, antes de
   * qualquer escrita. Reservado = soma de `order_items` de pedidos pendentes
   * ainda dentro do prazo (`PENDING_ORDER_TTL_MINUTES`) e pagos; cancelado ou
   * reserva vencida devolve a vaga. Fonte única da regra de estoque, usada
   * tanto pela compra (`placeOrder`) quanto pela emissão manual de ingressos.
   *
   * Deve rodar dentro de uma transaction (o lock só vale até ela terminar).
   * Devolve os lotes travados, indexados por id, para quem precisar do preço.
   */
  async assertBatchesHaveStock(
    requested: { ticketTypeId: string; quantity: number }[],
    executor: DbExecutor,
    { checkOnSale = false }: { checkOnSale?: boolean } = {},
  ) {
    const ids = requested.map((item) => item.ticketTypeId);
    const lots = await this.ticketTypeService.lockForPurchase(ids, executor);
    const lotsById = new Map(lots.map((lot) => [lot.ticketType.id, lot]));
    const now = new Date();
    const reserved = await this.orderItemRepository.sumReservedByTicketType(
      ids,
      executor,
      now,
    );

    for (const { ticketTypeId, quantity } of requested) {
      const lot = lotsById.get(ticketTypeId);
      if (!lot) {
        throw new NotFoundException(`Lote ${ticketTypeId} não encontrado`);
      }
      const { ticketType, event } = lot;
      const label = `lote "${ticketType.batch}" do evento "${event.name}"`;

      if (checkOnSale && !isOnSale(event, now)) {
        throw new UnprocessableEntityException(
          `As vendas do evento "${event.name}" não estão abertas`,
        );
      }

      const available = ticketType.quantity - (reserved.get(ticketTypeId) ?? 0);
      if (available <= 0) {
        throw new UnprocessableEntityException(`O ${label} está esgotado`);
      }
      if (quantity > available) {
        throw new UnprocessableEntityException(
          `O ${label} tem apenas ${available} ingresso(s) disponível(is)`,
        );
      }
    }

    return lotsById;
  }

  /**
   * Trava os lotes, confere o saldo e grava pedido e itens na mesma
   * transaction: ou o pedido nasce completo, ou nada é gravado.
   */
  private placeOrder(userId: string, dto: CreateOrderDto) {
    const requested = mergeItems(dto.items);

    return this.db.transaction(async (tx) => {
      const lots = await this.assertBatchesHaveStock(requested, tx, {
        checkOnSale: true,
      });

      let totalInCents = 0;
      const items = requested.map(({ ticketTypeId, quantity }) => {
        const { ticketType } = lots.get(ticketTypeId)!;
        totalInCents += Math.round(ticketType.price * 100) * quantity;
        return { ticketTypeId, quantity, unitPrice: ticketType.price };
      });

      const order = await this.orderRepository.create(
        { userId, totalAmount: totalInCents / 100 },
        tx,
      );
      const created = await this.orderItemRepository.createMany(
        items.map((item) => ({ ...item, orderId: order.id })),
        tx,
      );
      return { ...order, items: created };
    });
  }

  /**
   * Trava o pedido (`FOR UPDATE`) até o fim da transaction. Pedido de outra
   * pessoa responde 404, igual a pedido inexistente.
   */
  private async lockAccessible(
    id: string,
    user: AuthenticatedUser,
    executor: DbExecutor,
  ) {
    const order = await this.orderRepository.findByIdForUpdate(id, executor);
    if (!order || !canAccess(user, order.userId)) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
    return order;
  }

  /** Pedido de outra pessoa responde 404, para não revelar quais ids existem. */
  private async ensureAccessible(id: string, user: AuthenticatedUser) {
    const order = await this.findById(id);
    if (!canAccess(user, order.userId)) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
    return order;
  }
}

/** Lança 422 com o motivo quando a troca de status não é permitida no PATCH. */
function assertManualTransition(from: OrderStatus, to: OrderStatus) {
  if (MANUAL_STATUS_TRANSITIONS[from].includes(to)) return;

  if (to === 'pago') {
    throw new UnprocessableEntityException(
      'Pedido só pode ser marcado como pago pelo checkout (POST /payments)',
    );
  }
  if (from === 'pago') {
    throw new UnprocessableEntityException(
      'Pedido pago não pode ser cancelado; registre um estorno',
    );
  }
  throw new UnprocessableEntityException(
    `Não é permitido alterar o pedido de '${from}' para '${to}'`,
  );
}

/** Soma as linhas repetidas do mesmo lote, para validar o saldo uma vez só. */
function mergeItems(items: CreateOrderDto['items']) {
  const quantities = new Map<string, number>();
  for (const { ticketTypeId, quantity } of items) {
    quantities.set(
      ticketTypeId,
      (quantities.get(ticketTypeId) ?? 0) + quantity,
    );
  }
  return [...quantities].map(([ticketTypeId, quantity]) => ({
    ticketTypeId,
    quantity,
  }));
}

/** Vende só evento publicado, com vendas já abertas e que ainda não terminou. */
function isOnSale(
  event: { status: string; salesStartDate: Date | null; endDate: Date },
  now: Date,
) {
  return (
    event.status === 'published' &&
    (event.salesStartDate === null || event.salesStartDate <= now) &&
    event.endDate > now
  );
}
