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
import { FindAllOrdersFilters, OrderRepository } from './order.repository';

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
    const user = await this.usersService.findOne(authUser.id);

    const missing: string[] = [];
    if (!user.cpf) missing.push('cpf');
    if (!user.birthDate) missing.push('birthDate');

    if (missing.length > 0) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Complete o perfil antes de comprar',
        error: 'Forbidden',
        code: 'PROFILE_INCOMPLETE',
        missing,
      });
    }

    return this.placeOrder(authUser.id, dto);
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Apenas administradores podem alterar pedidos',
      );
    }

    const order = await this.ensureAccessible(id, user);
    if (order.status === 'cancelado') {
      throw new UnprocessableEntityException(
        'Pedido cancelado não pode ser alterado',
      );
    }

    return this.orderRepository.update(id, dto);
  }

  async cancel(id: string, user: AuthenticatedUser): Promise<void> {
    const order = await this.ensureAccessible(id, user);

    if (order.status === 'cancelado') {
      throw new UnprocessableEntityException('Pedido já está cancelado');
    }

    if (order.status === 'pago') {
      throw new UnprocessableEntityException(
        'Pedido pago não pode ser cancelado; registre um estorno',
      );
    }

    await this.orderRepository.update(id, { status: 'cancelado' });
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
    const order = await this.orderRepository.findByIdForUpdate(id, executor);
    if (!order || !canAccess(user, order.userId)) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
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

  findItems(orderId: string, executor: DbExecutor) {
    return this.orderItemRepository.findByOrder(orderId, executor);
  }

  markAsPaid(id: string, executor: DbExecutor) {
    return this.orderRepository.update(id, { status: 'pago' }, executor);
  }

  /**
   * Trava os lotes, confere o saldo e grava pedido e itens na mesma
   * transaction: ou o pedido nasce completo, ou nada é gravado.
   */
  private placeOrder(userId: string, dto: CreateOrderDto) {
    const requested = mergeItems(dto.items);
    const ids = requested.map((item) => item.ticketTypeId);

    return this.db.transaction(async (tx) => {
      const lots = await this.ticketTypeService.lockForPurchase(ids, tx);
      const lotsById = new Map(lots.map((lot) => [lot.ticketType.id, lot]));
      const reserved = await this.orderItemRepository.sumReservedByTicketType(
        ids,
        tx,
      );

      const now = new Date();
      let totalInCents = 0;
      const items = requested.map(({ ticketTypeId, quantity }) => {
        const lot = lotsById.get(ticketTypeId);
        if (!lot) {
          throw new NotFoundException(`Lote ${ticketTypeId} não encontrado`);
        }
        const { ticketType, event } = lot;
        const label = `lote "${ticketType.batch}" do evento "${event.name}"`;

        if (!isOnSale(event, now)) {
          throw new UnprocessableEntityException(
            `As vendas do evento "${event.name}" não estão abertas`,
          );
        }

        const available =
          ticketType.quantity - (reserved.get(ticketTypeId) ?? 0);
        if (available <= 0) {
          throw new UnprocessableEntityException(`O ${label} está esgotado`);
        }
        if (quantity > available) {
          throw new UnprocessableEntityException(
            `O ${label} tem apenas ${available} ingresso(s) disponível(is)`,
          );
        }

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

  /** Pedido de outra pessoa responde 404, para não revelar quais ids existem. */
  private async ensureAccessible(id: string, user: AuthenticatedUser) {
    const order = await this.findById(id);
    if (!canAccess(user, order.userId)) {
      throw new NotFoundException(`Pedido ${id} não encontrado`);
    }
    return order;
  }
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
