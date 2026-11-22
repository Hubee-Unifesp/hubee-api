import { relations } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './user';

/** Tipos de notificação in-app gerados pelos fluxos de compra e eventos. */
export const notificationType = pgEnum('notification_type', [
  'payment_confirmed',
  'order_cancelled',
  'order_refunded',
  'event_cancelled',
  'new_sale',
  'batch_sold_out',
]);

export type NotificationType = (typeof notificationType.enumValues)[number];

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: varchar('message', { length: 1000 }).notNull(),
    href: varchar('href', { length: 500 }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notifications_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
