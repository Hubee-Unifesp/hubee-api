import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, getTableColumns, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
  DrizzleTransaction,
} from '../../database/database.provider';
import {
  expenseInstallments,
  expenses,
  suppliers,
} from '../../database/schema';

@Injectable()
export class InstallmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  transaction<T>(callback: (tx: DrizzleTransaction) => Promise<T>) {
    return this.db.transaction(callback);
  }

  private selectWithExpense(executor: DbExecutor) {
    return executor
      .select({
        ...getTableColumns(expenseInstallments),
        expenseDescription: expenses.description,
        expenseGroup: expenses.group,
        expenseCategory: expenses.category,
        supplierName: suppliers.companyName,
      })
      .from(expenseInstallments)
      .innerJoin(expenses, eq(expenses.id, expenseInstallments.expenseId))
      .leftJoin(suppliers, eq(suppliers.id, expenses.supplierId));
  }

  private ordered() {
    return [
      asc(expenseInstallments.dueDate),
      asc(expenseInstallments.createdAt),
      asc(expenseInstallments.id),
    ];
  }

  async findAllByEvent(eventId: string, executor: DbExecutor = this.db) {
    return this.selectWithExpense(executor)
      .where(eq(expenses.eventId, eventId))
      .orderBy(...this.ordered());
  }

  async findAllByExpense(expenseId: string, executor: DbExecutor = this.db) {
    return this.selectWithExpense(executor)
      .where(eq(expenseInstallments.expenseId, expenseId))
      .orderBy(...this.ordered());
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    const [installment] = await this.selectWithExpense(executor).where(
      eq(expenseInstallments.id, id),
    );
    return installment;
  }

  async lockExpense(expenseId: string, executor: DbExecutor) {
    const [expense] = await executor
      .select({ id: expenses.id, amount: expenses.amount })
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .for('update');
    return expense;
  }

  async sumActiveAmount(
    expenseId: string,
    executor: DbExecutor = this.db,
    excludeId?: string,
  ): Promise<number> {
    const [row] = await executor
      .select({
        total: sql<string>`coalesce(sum(${expenseInstallments.amount}), 0)`,
      })
      .from(expenseInstallments)
      .where(
        and(
          eq(expenseInstallments.expenseId, expenseId),
          ne(expenseInstallments.status, 'cancelado'),
          excludeId ? ne(expenseInstallments.id, excludeId) : undefined,
        ),
      );
    return Number(row.total);
  }

  async create(
    data: typeof expenseInstallments.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [installment] = await executor
      .insert(expenseInstallments)
      .values(data)
      .returning();
    return (await this.findById(installment.id, executor))!;
  }

  async update(
    id: string,
    data: Partial<typeof expenseInstallments.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    await executor
      .update(expenseInstallments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(expenseInstallments.id, id));
    return (await this.findById(id, executor))!;
  }

  async delete(id: string, executor: DbExecutor = this.db): Promise<void> {
    await executor
      .delete(expenseInstallments)
      .where(eq(expenseInstallments.id, id));
  }
}
