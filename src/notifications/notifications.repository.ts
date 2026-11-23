import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import {
  events,
  notifications,
  orderItems,
  orders,
  organizationUsers,
  tickets,
} from '../database/schema';
import { DEFAULT_NOTIFICATIONS_LIMIT } from './dto/query-notifications.dto';

export interface FindUserNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAllByUser(
    userId: string,
    {
      unreadOnly = false,
      limit = DEFAULT_NOTIFICATIONS_LIMIT,
      offset = 0,
    }: FindUserNotificationsOptions = {},
    executor: DbExecutor = this.db,
  ) {
    const where = unreadOnly
      ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
      : eq(notifications.userId, userId);

    return executor
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit)
      .offset(offset);
  }

  async countUnreadByUser(
    userId: string,
    executor: DbExecutor = this.db,
  ): Promise<number> {
    const [{ total }] = await executor
      .select({ total: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );
    return total;
  }

  async findByIdAndUser(
    id: string,
    userId: string,
    executor: DbExecutor = this.db,
  ) {
    const [row] = await executor
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .limit(1);
    return row;
  }

  async markAsRead(
    id: string,
    userId: string,
    now: Date = new Date(),
    executor: DbExecutor = this.db,
  ) {
    const existing = await this.findByIdAndUser(id, userId, executor);
    if (!existing) return undefined;
    if (existing.readAt) return existing;

    const [updated] = await executor
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated ?? existing;
  }

  async markAllAsRead(
    userId: string,
    now: Date = new Date(),
    executor: DbExecutor = this.db,
  ): Promise<number> {
    const updated = await executor
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      )
      .returning({ id: notifications.id });
    return updated.length;
  }

  async create(
    data: typeof notifications.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [created] = await executor
      .insert(notifications)
      .values(data)
      .returning();
    return created;
  }

  async createMany(
    data: (typeof notifications.$inferInsert)[],
    executor: DbExecutor = this.db,
  ) {
    if (data.length === 0) return [];
    return executor.insert(notifications).values(data).returning();
  }

  async findAcceptedOrganizationMembers(
    organizationIds: string[],
    executor: DbExecutor = this.db,
  ): Promise<Map<string, string[]>> {
    const uniqueOrgIds = [...new Set(organizationIds)];
    if (uniqueOrgIds.length === 0) return new Map();

    const rows = await executor
      .select({
        orgId: organizationUsers.orgId,
        userId: organizationUsers.userId,
      })
      .from(organizationUsers)
      .where(
        and(
          inArray(organizationUsers.orgId, uniqueOrgIds),
          eq(organizationUsers.inviteStatus, 'accepted'),
        ),
      );

    const byOrg = new Map<string, string[]>();
    for (const { orgId, userId } of rows) {
      const list = byOrg.get(orgId) ?? [];
      if (!list.includes(userId)) {
        list.push(userId);
      }
      byOrg.set(orgId, list);
    }
    return byOrg;
  }

  async findEventsByIds(eventIds: string[], executor: DbExecutor = this.db) {
    const uniqueIds = [...new Set(eventIds)];
    if (uniqueIds.length === 0) return [];
    return executor
      .select({
        id: events.id,
        name: events.name,
        organizerId: events.organizerId,
      })
      .from(events)
      .where(inArray(events.id, uniqueIds));
  }

  async sumSoldByTicketType(
    ticketTypeIds: string[],
    executor: DbExecutor = this.db,
  ): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(ticketTypeIds)];
    if (uniqueIds.length === 0) return new Map();

    const itemRows = await executor
      .select({
        ticketTypeId: orderItems.ticketTypeId,
        paid: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          inArray(orderItems.ticketTypeId, uniqueIds),
          eq(orders.status, 'pago'),
        ),
      )
      .groupBy(orderItems.ticketTypeId);

    const ticketRows = await executor
      .select({
        ticketTypeId: tickets.ticketTypeId,
        issued: sql<number>`count(*) filter (where ${tickets.status} <> 'cancelado')::int`,
        cancelled: sql<number>`count(*) filter (where ${tickets.status} = 'cancelado')::int`,
      })
      .from(tickets)
      .where(inArray(tickets.ticketTypeId, uniqueIds))
      .groupBy(tickets.ticketTypeId);

    const statsByType = new Map(
      ticketRows.map((row) => [
        row.ticketTypeId,
        { issued: row.issued, cancelled: row.cancelled },
      ]),
    );
    const result = new Map<string, number>();

    for (const row of itemRows) {
      const stats = statsByType.get(row.ticketTypeId) ?? {
        issued: 0,
        cancelled: 0,
      };
      const paidActive = Math.max(0, row.paid - stats.cancelled);
      result.set(row.ticketTypeId, Math.max(paidActive, stats.issued));
      statsByType.delete(row.ticketTypeId);
    }

    for (const [ticketTypeId, stats] of statsByType) {
      result.set(ticketTypeId, stats.issued);
    }

    return result;
  }

  async findAffectedUsersByEvent(
    eventId: string,
    executor: DbExecutor = this.db,
  ): Promise<string[]> {
    const rows = await executor
      .select({
        holderUserId: tickets.holderUserId,
        buyerUserId: orders.userId,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .where(
        and(eq(tickets.eventId, eventId), ne(tickets.status, 'cancelado')),
      );

    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.holderUserId) userIds.add(row.holderUserId);
      if (row.buyerUserId) userIds.add(row.buyerUserId);
    }
    return [...userIds];
  }
}
