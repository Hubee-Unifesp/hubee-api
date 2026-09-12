import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { addresses, venues } from '../database/schema';

export interface FindAllVenuesFilters {
  city?: string;
  state?: string;
}

@Injectable()
export class VenueRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(filters: FindAllVenuesFilters, executor: DbExecutor = this.db) {
    const conditions = [
      filters.city ? ilike(addresses.city, filters.city) : undefined,
      filters.state
        ? eq(addresses.state, filters.state.toUpperCase())
        : undefined,
    ].filter((c) => c !== undefined);

    return executor
      .select({ venue: venues, address: addresses })
      .from(venues)
      .innerJoin(addresses, eq(venues.addressId, addresses.id))
      .where(conditions.length ? and(...conditions) : undefined);
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.venues.findFirst({
      where: eq(venues.id, id),
      with: { address: true },
    });
  }

  async create(
    data: typeof venues.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [venue] = await executor.insert(venues).values(data).returning();
    return venue;
  }

  async update(
    id: string,
    data: Partial<typeof venues.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [venue] = await executor
      .update(venues)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(venues.id, id))
      .returning();
    return venue;
  }

  async delete(id: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.delete(venues).where(eq(venues.id, id));
  }
}
