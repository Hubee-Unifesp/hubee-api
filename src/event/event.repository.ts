import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import {
  addresses,
  EventStatus,
  events,
  orders,
  organizations,
  tickets,
  ticketTypes,
  venues,
} from '../database/schema';

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

  async findUpcomingSummaries(executor: DbExecutor = this.db) {
    const nullableNumber = (value: unknown) =>
      value === null ? null : Number(value);

    return executor
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        category: events.category,
        startDate: events.startDate,
        endDate: events.endDate,
        featured: events.featured,
        organizerName: organizations.name,
        venueName: venues.name,
        venueCity: addresses.city,
        minPrice: sql<number | null>`(
          SELECT ${ticketTypes.price}
          FROM ${ticketTypes}
          WHERE ${ticketTypes.eventId} = ${events.id}
          ORDER BY ${ticketTypes.price}, ${ticketTypes.createdAt}, ${ticketTypes.id}
          LIMIT 1
        )`.mapWith(nullableNumber),
        minPriceBatch: sql<string | null>`(
          SELECT ${ticketTypes.batch}
          FROM ${ticketTypes}
          WHERE ${ticketTypes.eventId} = ${events.id}
          ORDER BY ${ticketTypes.price}, ${ticketTypes.createdAt}, ${ticketTypes.id}
          LIMIT 1
        )`,
        capacity: sql<number>`(
          SELECT COALESCE(SUM(${ticketTypes.quantity}), 0)::integer
          FROM ${ticketTypes}
          WHERE ${ticketTypes.eventId} = ${events.id}
        )`,
        ticketsSold: sql<number>`(
          SELECT COUNT(*)::integer
          FROM ${tickets}
          INNER JOIN ${orders} ON ${orders.id} = ${tickets.orderId}
          WHERE ${tickets.eventId} = ${events.id}
            AND ${orders.status} = 'pago'
        )`,
      })
      .from(events)
      .innerJoin(organizations, eq(events.organizerId, organizations.id))
      .innerJoin(venues, eq(events.venueId, venues.id))
      .innerJoin(addresses, eq(venues.addressId, addresses.id))
      .where(
        and(eq(events.status, 'published'), gt(events.startDate, new Date())),
      )
      .orderBy(asc(events.startDate));
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
