import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { ExpensePaymentStatus, expenses } from '../database/schema';

export interface FindAllExpensesFilters {
  eventId: string;
  paymentStatus?: ExpensePaymentStatus;
}

@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(
    filters: FindAllExpensesFilters,
    executor: DbExecutor = this.db,
  ) {
    const conditions = [
      eq(expenses.eventId, filters.eventId),
      filters.paymentStatus
        ? eq(expenses.paymentStatus, filters.paymentStatus)
        : undefined,
    ].filter((condition) => condition !== undefined);

    return executor
      .select()
      .from(expenses)
      .where(and(...conditions));
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.expenses.findFirst({ where: eq(expenses.id, id) });
  }

  async create(
    data: typeof expenses.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [expense] = await executor.insert(expenses).values(data).returning();
    return expense;
  }

  async update(
    id: string,
    data: Partial<typeof expenses.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [expense] = await executor
      .update(expenses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return expense;
  }

  async delete(id: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.delete(expenses).where(eq(expenses.id, id));
  }
}
