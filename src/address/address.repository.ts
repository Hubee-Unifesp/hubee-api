import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { addresses } from '../database/schema';

@Injectable()
export class AddressRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async create(
    data: typeof addresses.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [address] = await executor.insert(addresses).values(data).returning();
    return address;
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.addresses.findFirst({ where: eq(addresses.id, id) });
  }

  async findByFullAddress(
    data: typeof addresses.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const complementCondition = data.complement
      ? eq(addresses.complement, data.complement)
      : isNull(addresses.complement);

    return executor.query.addresses.findFirst({
      where: and(
        eq(addresses.zipCode, data.zipCode),
        eq(addresses.street, data.street),
        eq(addresses.number, data.number),
        complementCondition,
        eq(addresses.neighborhood, data.neighborhood),
        eq(addresses.city, data.city),
        eq(addresses.state, data.state),
        eq(addresses.country, data.country ?? 'Brasil'),
      ),
    });
  }

  async update(
    id: string,
    data: Partial<typeof addresses.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [address] = await executor
      .update(addresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(addresses.id, id))
      .returning();
    return address;
  }
}
