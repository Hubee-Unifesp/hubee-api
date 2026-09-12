import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { addresses } from './address.schema';
import { relations } from 'drizzle-orm';

export const venues = pgTable(
  'venues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    addressId: uuid('address_id')
      .notNull()
      .references(() => addresses.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('venues_max_capacity_positive', sql`${table.maxCapacity} > 0`),
  ],
);

export const addressesRelations = relations(addresses, ({ many }) => ({
  venues: many(venues),
}));

export const venuesRelations = relations(venues, ({ one }) => ({
  address: one(addresses, {
    fields: [venues.addressId],
    references: [addresses.id],
  }),
}));
