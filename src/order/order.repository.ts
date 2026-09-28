import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { OrderStatus, orders } from '../database/schema';

export interface FindAllOrdersFilters {
  userId?: string;
  status?: OrderStatus;
}

@Injectable()
export class OrderRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(filters: FindAllOrdersFilters, executor: DbExecutor = this.db) {
    const conditions = [
      filters.userId ? eq(orders.userId, filters.userId) : undefined,
      filters.status ? eq(orders.status, filters.status) : undefined,
    ].filter((condition) => condition !== undefined);

    return executor
      .select()
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.orders.findFirst({ where: eq(orders.id, id) });
  }

  async create(
    data: typeof orders.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [order] = await executor.insert(orders).values(data).returning();
    return order;
  }

  async update(
    id: string,
    data: Partial<typeof orders.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [order] = await executor
      .update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }
}
