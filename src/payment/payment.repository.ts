import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { payments } from '../database/schema';

@Injectable()
export class PaymentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findByOrderId(orderId: string, executor: DbExecutor = this.db) {
    return executor.query.payments.findFirst({
      where: eq(payments.orderId, orderId),
    });
  }

  async create(
    data: typeof payments.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [payment] = await executor.insert(payments).values(data).returning();
    return payment;
  }

  async update(
    id: string,
    data: Partial<typeof payments.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [payment] = await executor
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }
}
