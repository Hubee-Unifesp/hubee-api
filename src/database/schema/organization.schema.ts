import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './user';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  photoUrl: varchar('photo_url', { length: 2048 }),
  titleColor: varchar('title_color', { length: 7 }),
  descriptionColor: varchar('description_color', { length: 7 }),
  // Opcional: a organização pode existir sem representante, e se o usuário
  // for removido a organização continua, apenas sem representante.
  representativeId: uuid('representative_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
