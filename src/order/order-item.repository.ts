import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { orderItems, orders } from '../database/schema';

@Injectable()
export class OrderItemRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Com o lote junto, porque a emissão dos ingressos precisa do `eventId`. */
  async findByOrder(orderId: string, executor: DbExecutor = this.db) {
    return executor.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
      with: { ticketType: true },
      orderBy: [asc(orderItems.createdAt), asc(orderItems.id)],
    });
  }

  async createMany(
    data: (typeof orderItems.$inferInsert)[],
    executor: DbExecutor = this.db,
  ) {
    return executor.insert(orderItems).values(data).returning();
  }

  /**
   * Quantidade já reservada por lote. Pedido pendente reserva o saldo e pedido
   * pago o consome; só o cancelado o devolve.
   */
  async sumReservedByTicketType(
    ticketTypeIds: string[],
    executor: DbExecutor = this.db,
  ): Promise<Map<string, number>> {
    const rows = await executor
      .select({
        ticketTypeId: orderItems.ticketTypeId,
        reserved: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        sql`${inArray(orderItems.ticketTypeId, ticketTypeIds)} and ${orders.status} in ('pendente', 'pago')`,
      )
      .groupBy(orderItems.ticketTypeId);

    return new Map(rows.map((row) => [row.ticketTypeId, row.reserved]));
  }
}
