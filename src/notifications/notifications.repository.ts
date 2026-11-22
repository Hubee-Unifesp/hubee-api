import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
} from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import {
  events,
  notifications,
  orders,
  organizationUsers,
  tickets,
} from '../database/schema';

export interface FindUserNotificationsOptions {
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAllByUser(
    userId: string,
    { unreadOnly = false }: FindUserNotificationsOptions = {},
    executor: DbExecutor = this.db,
  ) {
    const where = unreadOnly
      ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
      : eq(notifications.userId, userId);

    return executor
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id));
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

  /** Retorna os `userId`s com vínculo aceito nas organizações informadas. */
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

  /** Busca eventos pelos IDs informados. */
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

  /**
   * Busca usuários distintos que possuem ingressos ativos (não cancelados) ou
   * pedidos pagos vinculados a um evento, para notificá-los caso o evento seja
   * cancelado.
   */
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
