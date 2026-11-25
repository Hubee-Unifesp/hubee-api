import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, getTableColumns, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import {
  ExpenseGroup,
  ExpensePaymentStatus,
  expenses,
  suppliers,
} from '../database/schema';

export interface FindAllExpensesFilters {
  eventId: string;
  group?: ExpenseGroup;
  category?: string;
  quoted?: boolean;
  paymentStatus?: ExpensePaymentStatus;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  private selectWithSupplier(executor: DbExecutor) {
    return executor
      .select({
        ...getTableColumns(expenses),
        supplierName: suppliers.companyName,
      })
      .from(expenses)
      .leftJoin(suppliers, eq(suppliers.id, expenses.supplierId));
  }

  async findAll(
    filters: FindAllExpensesFilters,
    executor: DbExecutor = this.db,
  ) {
    const conditions = [
      eq(expenses.eventId, filters.eventId),
      filters.group ? eq(expenses.group, filters.group) : undefined,
      filters.category
        ? ilike(expenses.category, escapeLike(filters.category))
        : undefined,
      filters.quoted !== undefined
        ? eq(expenses.quoted, filters.quoted)
        : undefined,
      filters.paymentStatus
        ? eq(expenses.paymentStatus, filters.paymentStatus)
        : undefined,
    ].filter((condition) => condition !== undefined);

    return this.selectWithSupplier(executor)
      .where(and(...conditions))
      .orderBy(
        asc(expenses.group),
        asc(expenses.category),
        asc(expenses.createdAt),
        asc(expenses.id),
      );
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    const [expense] = await this.selectWithSupplier(executor).where(
      eq(expenses.id, id),
    );
    return expense;
  }

  async create(
    data: typeof expenses.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [expense] = await executor.insert(expenses).values(data).returning();
    return (await this.findById(expense.id, executor))!;
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
    return (await this.findById(expense.id, executor))!;
  }

  async delete(id: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.delete(expenses).where(eq(expenses.id, id));
  }
}
