import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  zipCode: varchar('zip_code', { length: 9 }).notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  number: varchar('number', { length: 20 }).notNull(),
  complement: varchar('complement', { length: 255 }),
  neighborhood: varchar('neighborhood', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  country: varchar('country', { length: 100 }).notNull().default('Brasil'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
