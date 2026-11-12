import { relations, sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { suppliers } from './supplier';
import { users } from './user';

export const supplierReviews = pgTable(
  'supplier_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: varchar('comment', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('supplier_reviews_supplier_id_user_id_unique').on(
      table.supplierId,
      table.userId,
    ),
    check(
      'supplier_reviews_rating_range',
      sql`${table.rating} >= 1 and ${table.rating} <= 5`,
    ),
  ],
);

export const supplierReviewsRelations = relations(
  supplierReviews,
  ({ one }) => ({
    supplier: one(suppliers, {
      fields: [supplierReviews.supplierId],
      references: [suppliers.id],
    }),
    user: one(users, {
      fields: [supplierReviews.userId],
      references: [users.id],
    }),
  }),
);
