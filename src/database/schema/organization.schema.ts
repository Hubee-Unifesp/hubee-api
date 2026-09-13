import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { usuarios } from './usuario';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  // Opcional: a organização pode existir sem representante, e se o usuário
  // for removido a organização continua, apenas sem representante.
  representativeId: uuid('representative_id').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
