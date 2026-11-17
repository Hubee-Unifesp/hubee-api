import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { events, orderItems } from '../database/schema';
import { sumCommittedByTicketType } from './order-reservation';

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

  async findEventsForShare(eventIds: string[], executor: DbExecutor) {
    const ids = [...new Set(eventIds)].sort();
    if (ids.length === 0) return [];
    return executor
      .select()
      .from(events)
      .where(inArray(events.id, ids))
      .orderBy(asc(events.id))
      .for('share');
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
