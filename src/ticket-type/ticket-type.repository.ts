import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { events, ticketTypes } from '../database/schema';

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

  /**
   * Trava os lotes (`FOR UPDATE`) até o fim da transaction: duas compras do
   * último ingresso ao mesmo tempo passam uma depois da outra, e a segunda já
   * enxerga o saldo descontado. A ordenação por id evita deadlock entre
   * compras que pedem os mesmos lotes em ordens diferentes.
   */
  async findManyForPurchase(ids: string[], executor: DbExecutor = this.db) {
    return executor
      .select({ ticketType: ticketTypes, event: events })
      .from(ticketTypes)
      .innerJoin(events, eq(events.id, ticketTypes.eventId))
      .where(inArray(ticketTypes.id, ids))
      .orderBy(asc(ticketTypes.id))
      .for('update', { of: ticketTypes });
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
