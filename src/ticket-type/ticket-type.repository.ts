import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { ticketTypes } from '../database/schema';

/**
 * Toda leitura e escrita recebe o `eventId` junto do `id`: o tipo de ingresso
 * é um sub-recurso do evento, então um tipo de ingresso de outro evento se
 * comporta como inexistente.
 */
@Injectable()
export class TicketTypeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(eventId: string, executor: DbExecutor = this.db) {
    return executor
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId))
      .orderBy(asc(ticketTypes.createdAt));
  }

  async findById(eventId: string, id: string, executor: DbExecutor = this.db) {
    return executor.query.ticketTypes.findFirst({
      where: and(eq(ticketTypes.id, id), eq(ticketTypes.eventId, eventId)),
    });
  }

  async create(
    data: typeof ticketTypes.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [ticketType] = await executor
      .insert(ticketTypes)
      .values(data)
      .returning();
    return ticketType;
  }

  async update(
    eventId: string,
    id: string,
    data: Partial<typeof ticketTypes.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [ticketType] = await executor
      .update(ticketTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(ticketTypes.id, id), eq(ticketTypes.eventId, eventId)))
      .returning();
    return ticketType;
  }

  async delete(eventId: string, id: string, executor: DbExecutor = this.db) {
    await executor
      .delete(ticketTypes)
      .where(and(eq(ticketTypes.id, id), eq(ticketTypes.eventId, eventId)));
  }
}
