import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { EventStatus, events } from '../database/schema';

export interface FindAllEventsFilters {
  organizerId?: string;
  venueId?: string;
  status?: EventStatus;
  featured?: boolean;
}

@Injectable()
export class EventRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(filters: FindAllEventsFilters, executor: DbExecutor = this.db) {
    const conditions = [
      filters.organizerId
        ? eq(events.organizerId, filters.organizerId)
        : undefined,
      filters.venueId ? eq(events.venueId, filters.venueId) : undefined,
      filters.status ? eq(events.status, filters.status) : undefined,
      filters.featured !== undefined
        ? eq(events.featured, filters.featured)
        : undefined,
    ].filter((condition) => condition !== undefined);

    return executor
      .select()
      .from(events)
      .where(conditions.length ? and(...conditions) : undefined);
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.events.findFirst({ where: eq(events.id, id) });
  }

  async create(
    data: typeof events.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [event] = await executor.insert(events).values(data).returning();
    return event;
  }

  async update(
    id: string,
    data: Partial<typeof events.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [event] = await executor
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event;
  }
}
