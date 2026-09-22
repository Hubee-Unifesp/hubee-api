import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { TaskStatus, tasks } from '../database/schema';

export interface FindAllTasksFilters {
  status?: TaskStatus;
  responsibleUserId?: string;
}

/**
 * Toda leitura e escrita recebe o `eventId` junto do `id`: a tarefa é um
 * sub-recurso do evento, então uma tarefa de outro evento se comporta como
 * inexistente.
 */
@Injectable()
export class TaskRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(
    eventId: string,
    filters: FindAllTasksFilters,
    executor: DbExecutor = this.db,
  ) {
    const conditions = [
      eq(tasks.eventId, eventId),
      filters.status ? eq(tasks.status, filters.status) : undefined,
      filters.responsibleUserId
        ? eq(tasks.responsibleUserId, filters.responsibleUserId)
        : undefined,
    ].filter((condition) => condition !== undefined);

    // Checklist: prazos mais próximos primeiro, tarefas sem prazo no fim.
    return executor
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt));
  }

  async findById(eventId: string, id: string, executor: DbExecutor = this.db) {
    return executor.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.eventId, eventId)),
    });
  }

  async create(
    data: typeof tasks.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [task] = await executor.insert(tasks).values(data).returning();
    return task;
  }

  async update(
    eventId: string,
    id: string,
    data: Partial<typeof tasks.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [task] = await executor
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.eventId, eventId)))
      .returning();
    return task;
  }

  async delete(eventId: string, id: string, executor: DbExecutor = this.db) {
    await executor
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.eventId, eventId)));
  }
}
