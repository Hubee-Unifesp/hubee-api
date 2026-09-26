import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { pagamentos } from '../database/schema';

@Injectable()
export class PagamentoRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findByOrderId(orderId: string, executor: DbExecutor = this.db) {
    return executor.query.pagamentos.findFirst({
      where: eq(pagamentos.orderId, orderId),
    });
  }

  async create(
    data: typeof pagamentos.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [pagamento] = await executor
      .insert(pagamentos)
      .values(data)
      .returning();
    return pagamento;
  }

  async update(
    id: string,
    data: Partial<typeof pagamentos.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [pagamento] = await executor
      .update(pagamentos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pagamentos.id, id))
      .returning();
    return pagamento;
  }
}
