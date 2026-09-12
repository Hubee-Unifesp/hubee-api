import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
