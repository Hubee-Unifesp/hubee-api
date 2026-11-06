import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { orderItems, orders, tickets } from '../database/schema';

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
   * Quantidade já comprometida por lote: pedidos pendentes reservam o saldo e
   * pedidos pagos (ou ingressos emitidos manualmente via ADMIN) o consomem;
   * pedidos/ingressos cancelados devolvem a vaga.
   */
  async sumReservedByTicketType(
    ticketTypeIds: string[],
    executor: DbExecutor = this.db,
  ): Promise<Map<string, number>> {
    if (ticketTypeIds.length === 0) return new Map();

    const itemRows = await executor
      .select({
        ticketTypeId: orderItems.ticketTypeId,
        pending: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'pendente'), 0)::int`,
        paid: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'pago'), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        sql`${inArray(orderItems.ticketTypeId, ticketTypeIds)} and ${orders.status} in ('pendente', 'pago')`,
      )
      .groupBy(orderItems.ticketTypeId);

    const ticketRows = await executor
      .select({
        ticketTypeId: tickets.ticketTypeId,
        issued: sql<number>`count(*)::int`,
      })
      .from(tickets)
      .where(
        and(
          inArray(tickets.ticketTypeId, ticketTypeIds),
          ne(tickets.status, 'cancelado'),
        ),
      )
      .groupBy(tickets.ticketTypeId);

    const issuedByType = new Map(
      ticketRows.map((row) => [row.ticketTypeId, row.issued]),
    );
    const result = new Map<string, number>();

    for (const row of itemRows) {
      const issued = issuedByType.get(row.ticketTypeId) ?? 0;
      result.set(row.ticketTypeId, row.pending + Math.max(row.paid, issued));
      issuedByType.delete(row.ticketTypeId);
    }

    for (const [ticketTypeId, issued] of issuedByType) {
      result.set(ticketTypeId, issued);
    }

    return result;
  }
}
