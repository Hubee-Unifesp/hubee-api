import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const fornecedores = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    cnpjCpf: varchar('cnpj_cpf', { length: 20 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    category: varchar('category', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    uniqueIndex('suppliers_cnpj_cpf_unique')
      .on(table.cnpjCpf)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('suppliers_email_unique')
      .on(table.email)
      .where(sql`${table.deletedAt} is null`),
  ],
);
