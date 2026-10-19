import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
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
  search?: string;
  category?: string;
  city?: string;
  startDate?: Date;
  endDate?: Date;
  organizerId?: string;
  venueId?: string;
  status?: EventStatus;
  featured?: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const nullableNumber = (value: unknown) =>
  value === null ? null : Number(value);

const soldInBatch = sql`(
  SELECT COUNT(*)
  FROM ${tickets}
  INNER JOIN ${orders} ON ${orders.id} = ${tickets.orderId}
  WHERE ${tickets.ticketTypeId} = ${ticketTypes.id}
    AND ${orders.status} = 'pago'
)`;

const cheapestTicketType = (column: AnyPgColumn) => sql`(
  SELECT ${column}
  FROM ${ticketTypes}
  WHERE ${ticketTypes.eventId} = ${events.id}
  ORDER BY
    ${ticketTypes.quantity} > ${soldInBatch} DESC,
    ${ticketTypes.price},
    ${ticketTypes.createdAt},
    ${ticketTypes.id}
  LIMIT 1
)`;

const minPrice = sql<
  number | null
>`${cheapestTicketType(ticketTypes.price)}`.mapWith(nullableNumber);
const minPriceBatch = sql<
  string | null
>`${cheapestTicketType(ticketTypes.batch)}`;

@Injectable()
export class EventRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(
    filters: FindAllEventsFilters,
    { page, limit }: Pagination,
    executor: DbExecutor = this.db,
  ) {
    const search = filters.search && `%${escapeLike(filters.search)}%`;
    const conditions = [
      search
        ? or(ilike(events.name, search), ilike(events.description, search))
        : undefined,
      filters.category
        ? ilike(events.category, escapeLike(filters.category))
        : undefined,
      filters.city
        ? ilike(addresses.city, escapeLike(filters.city))
        : undefined,
      filters.startDate ? gte(events.endDate, filters.startDate) : undefined,
      filters.endDate ? lte(events.startDate, filters.endDate) : undefined,
      filters.organizerId
        ? eq(events.organizerId, filters.organizerId)
        : undefined,
      filters.venueId ? eq(events.venueId, filters.venueId) : undefined,
      filters.status ? eq(events.status, filters.status) : undefined,
      filters.featured !== undefined
        ? eq(events.featured, filters.featured)
        : undefined,
    ].filter((condition) => condition !== undefined);
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, [{ total }]] = await Promise.all([
      executor
        .select({
          ...getTableColumns(events),
          venueName: venues.name,
          venueCity: addresses.city,
          minPrice,
          minPriceBatch,
        })
        .from(events)
        .innerJoin(venues, eq(events.venueId, venues.id))
        .innerJoin(addresses, eq(venues.addressId, addresses.id))
        .where(where)
        .orderBy(asc(events.startDate), asc(events.id))
        .limit(limit)
        .offset((page - 1) * limit),
      executor
        .select({ total: count() })
        .from(events)
        .innerJoin(venues, eq(events.venueId, venues.id))
        .innerJoin(addresses, eq(venues.addressId, addresses.id))
        .where(where),
    ]);

    return { data, total };
  }

  async findUpcomingSummaries(executor: DbExecutor = this.db) {
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
        minPrice,
        minPriceBatch,
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
        and(eq(events.status, 'published'), gt(events.endDate, new Date())),
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
