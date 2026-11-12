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
import { findAcceptedMembership } from '../auth/organization-membership';
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
import { withAvailability } from '../order/order-reservation';

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

/** Soma das capacidades dos lotes do evento. */
const capacity = sql<number>`(
  SELECT COALESCE(SUM(${ticketTypes.quantity}), 0)::integer
  FROM ${ticketTypes}
  WHERE ${ticketTypes.eventId} = ${events.id}
)`;

/** Ingressos de pedidos pagos do evento. */
const ticketsSold = sql<number>`(
  SELECT COUNT(*)::integer
  FROM ${tickets}
  INNER JOIN ${orders} ON ${orders.id} = ${tickets.orderId}
  WHERE ${tickets.eventId} = ${events.id}
    AND ${orders.status} = 'pago'
)`;

/** Sufixo do nome do evento duplicado; o nome é cortado para caber em 255. */
const COPY_SUFFIX = ' (cópia)';
const EVENT_NAME_MAX_LENGTH = 255;

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
          capacity,
          ticketsSold,
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
        capacity,
        ticketsSold,
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

  /** Vínculo aceito do usuário com a organização, ou `undefined`. */
  findMembership(
    userId: string,
    organizationId: string,
    executor: DbExecutor = this.db,
  ) {
    return findAcceptedMembership(executor, userId, organizationId);
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.events.findFirst({ where: eq(events.id, id) });
  }

  /** Detalhe público do evento, com o saldo real (`available`) de cada lote. */
  async findDetailById(id: string, executor: DbExecutor = this.db) {
    const event = await executor.query.events.findFirst({
      where: eq(events.id, id),
      with: {
        venue: { with: { address: true } },
        organization: true,
        ticketTypes: {
          orderBy: [
            asc(ticketTypes.createdAt),
            asc(ticketTypes.price),
            asc(ticketTypes.id),
          ],
        },
      },
    });
    if (!event) return undefined;
    return {
      ...event,
      ticketTypes: await withAvailability(executor, event.ticketTypes),
    };
  }

  async countTicketTypes(
    eventId: string,
    executor: DbExecutor = this.db,
  ): Promise<number> {
    const [{ total }] = await executor
      .select({ total: count() })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
    return total;
  }

  /**
   * Copia o evento como rascunho, junto com os lotes (nome, preço, capacidade,
   * modalidade e janela de vendas; vendas e reservas não vão para a cópia). A capa e o destaque
   * ficam de fora: a capa está guardada no caminho do evento original e seria
   * apagada quando a cópia trocasse de capa.
   */
  async duplicate(id: string) {
    return this.db.transaction(async (tx) => {
      const original = await tx.query.events.findFirst({
        where: eq(events.id, id),
        with: { ticketTypes: { orderBy: [asc(ticketTypes.createdAt)] } },
      });
      if (!original) return undefined;

      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ticketTypes: lots,
        ...fields
      } = original;
      const name =
        fields.name.slice(0, EVENT_NAME_MAX_LENGTH - COPY_SUFFIX.length) +
        COPY_SUFFIX;

      const [copy] = await tx
        .insert(events)
        .values({
          ...fields,
          name,
          status: 'draft',
          featured: false,
          photoUrl: null,
        })
        .returning();

      if (lots.length > 0) {
        await tx.insert(ticketTypes).values(
          lots.map(
            ({
              batch,
              price,
              quantity,
              modality,
              salesStartDate,
              salesEndDate,
            }) => ({
              eventId: copy.id,
              batch,
              price,
              quantity,
              modality,
              salesStartDate,
              salesEndDate,
            }),
          ),
        );
      }

      return copy;
    });
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
