import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const usuarios = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    password: varchar('password', { length: 255 }).notNull(),
    cpf: varchar('cpf', { length: 11 }).notNull(),
    birthDate: date('birth_date').notNull(),
    profileType: varchar('profile_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).default('ACTIVE'), // Já mudei de ATIVO para ACTIVE para padronizar
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    uniqueIndex('users_email_unique')
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('users_cpf_unique')
      .on(table.cpf)
      .where(sql`${table.deletedAt} is null`),
  ],
);
