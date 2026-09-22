import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { DespesaPaymentStatus, despesas } from '../database/schema';

export interface FindAllDespesasFilters {
  eventId: string;
  paymentStatus?: DespesaPaymentStatus;
}

@Injectable()
export class DespesasRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(
    filters: FindAllDespesasFilters,
    executor: DbExecutor = this.db,
  ) {
    const conditions = [
      eq(despesas.eventId, filters.eventId),
      filters.paymentStatus
        ? eq(despesas.paymentStatus, filters.paymentStatus)
        : undefined,
    ].filter((condition) => condition !== undefined);

    return executor
      .select()
      .from(despesas)
      .where(and(...conditions));
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.despesas.findFirst({ where: eq(despesas.id, id) });
  }

  async create(
    data: typeof despesas.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [despesa] = await executor.insert(despesas).values(data).returning();
    return despesa;
  }

  async update(
    id: string,
    data: Partial<typeof despesas.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [despesa] = await executor
      .update(despesas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(despesas.id, id))
      .returning();
    return despesa;
  }

  async delete(id: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.delete(despesas).where(eq(despesas.id, id));
  }
}
