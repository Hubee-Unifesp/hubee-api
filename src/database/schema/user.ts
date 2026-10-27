import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  date,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    password: varchar('password', { length: 255 }).notNull(),
    cpf: varchar('cpf', { length: 11 }),
    birthDate: date('birth_date'),
    role: varchar('role', { length: 20 })
      .$type<'USER' | 'ADMIN'>()
      .default('USER')
      .notNull(),
    signupIntent: varchar('signup_intent', { length: 20 }).$type<
      'BUY' | 'ORGANIZE'
    >(),
    status: varchar('status', { length: 20 }).default('ACTIVE'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    check('users_role_check', sql`${table.role} in ('USER', 'ADMIN')`),
    check(
      'users_signup_intent_check',
      sql`${table.signupIntent} in ('BUY', 'ORGANIZE')`,
    ),
    uniqueIndex('users_email_unique')
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('users_cpf_unique')
      .on(table.cpf)
      .where(sql`${table.deletedAt} is null`),
  ],
);
