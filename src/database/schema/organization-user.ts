import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { usuarios } from './usuario';
import { organizations } from './organization.schema'; // <-- 1. Nova importação adicionada

export const organizacaoUsuarios = pgTable(
  'organization_users',
  {
    orgId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id), // <-- 2. Referência (FK) adicionada aqui

    userId: uuid('user_id')
      .notNull()
      .references(() => usuarios.id),
    papel: varchar('role', { length: 20 }).notNull(),
    permissao: varchar('permission', { length: 20 }).notNull(),
    statusConvite: varchar('invite_status', { length: 20 })
      .notNull()
      .default('pendente'),
    dataCriacao: timestamp('created_at').defaultNow(),
    dataModificacao: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.userId] }),
  }),
);
