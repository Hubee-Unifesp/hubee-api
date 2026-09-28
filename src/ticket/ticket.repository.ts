import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { TicketStatus, tickets } from '../database/schema';

@Injectable()
export class TicketRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAllByOrder(orderId: string, executor: DbExecutor = this.db) {
    return executor
      .select()
      .from(tickets)
      .where(eq(tickets.orderId, orderId))
      .orderBy(asc(tickets.createdAt));
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.tickets.findFirst({ where: eq(tickets.id, id) });
  }

  /** Um único INSERT: ou todos os ingressos do lote são criados, ou nenhum. */
  async createMany(
    data: (typeof tickets.$inferInsert)[],
    executor: DbExecutor = this.db,
  ) {
    return executor.insert(tickets).values(data).returning();
  }

  /**
   * Só grava se o ingresso ainda estiver em `from`: duas leituras do QR code
   * na portaria ao mesmo tempo não podem ambas marcá-lo como usado. Devolve
   * `undefined` quando outra requisição mudou o status antes.
   */
  async updateStatus(
    id: string,
    from: TicketStatus,
    to: TicketStatus,
    executor: DbExecutor = this.db,
  ): Promise<typeof tickets.$inferSelect | undefined> {
    const [ticket] = await executor
      .update(tickets)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(tickets.id, id), eq(tickets.status, from)))
      .returning();
    return ticket;
  }
}
