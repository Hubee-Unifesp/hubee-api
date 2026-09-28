import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { organizationEvents } from '../database/schema';

@Injectable()
export class OrganizationEventRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAllByEvent(eventId: string, executor: DbExecutor = this.db) {
    return executor
      .select()
      .from(organizationEvents)
      .where(eq(organizationEvents.eventId, eventId));
  }

  async findOne(
    eventId: string,
    organizationId: string,
    executor: DbExecutor = this.db,
  ): Promise<typeof organizationEvents.$inferSelect | undefined> {
    const [link] = await executor
      .select()
      .from(organizationEvents)
      .where(
        and(
          eq(organizationEvents.eventId, eventId),
          eq(organizationEvents.organizationId, organizationId),
        ),
      );
    return link;
  }

  async create(
    data: typeof organizationEvents.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [link] = await executor
      .insert(organizationEvents)
      .values(data)
      .returning();
    return link;
  }

  async delete(
    eventId: string,
    organizationId: string,
    executor: DbExecutor = this.db,
  ): Promise<void> {
    await executor
      .delete(organizationEvents)
      .where(
        and(
          eq(organizationEvents.eventId, eventId),
          eq(organizationEvents.organizationId, organizationId),
        ),
      );
  }
}
