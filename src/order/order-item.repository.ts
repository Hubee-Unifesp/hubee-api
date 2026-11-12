import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { orderItems } from '../database/schema';
import { sumCommittedByTicketType } from './order-reservation';

@Injectable()
export class OrderItemRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Com o lote e o evento juntos: o checkout revalida o evento e a emissão usa o `eventId`. */
  async findByOrder(orderId: string, executor: DbExecutor = this.db) {
    return executor.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
      with: { ticketType: { with: { event: true } } },
      orderBy: [asc(orderItems.createdAt), asc(orderItems.id)],
    });
  }

  async createMany(
    data: (typeof orderItems.$inferInsert)[],
    executor: DbExecutor = this.db,
  ) {
    return executor.insert(orderItems).values(data).returning();
  }

  /** Ver `sumCommittedByTicketType`: reservas pendentes vencidas não contam. */
  sumReservedByTicketType(
    ticketTypeIds: string[],
    executor: DbExecutor = this.db,
    now: Date = new Date(),
  ): Promise<Map<string, number>> {
    return sumCommittedByTicketType(executor, ticketTypeIds, now);
  }
}
