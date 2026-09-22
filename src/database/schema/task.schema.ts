import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { events } from './event.schema';
import { usuarios } from './user';

/** Situações de uma tarefa no checklist de organização do evento. */
export const taskStatus = pgEnum('task_status', [
  'pending',
  'in_progress',
  'done',
]);

export type TaskStatus = (typeof taskStatus.enumValues)[number];

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // `cascade`: a tarefa só faz sentido dentro do planejamento do evento.
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // `restrict`: a exclusão de usuário no sistema é lógica (deleted_at), então
    // um DELETE físico com tarefas atribuídas indica erro e deve falhar.
    responsibleUserId: uuid('responsible_user_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    status: taskStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('tasks_event_id_idx').on(table.eventId),
    index('tasks_responsible_user_id_idx').on(table.responsibleUserId),
  ],
);
