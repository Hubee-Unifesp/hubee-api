import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { usuarios } from './user';
import { organizations } from './organization.schema';

/**
 * Nomenclatura: propriedades e colunas em inglês (role, permission,
 * invite_status). O service, os DTOs e a resposta da API seguem o mesmo padrão.
 */
export const organizationUsers = pgTable(
  'organization_users',
  {
    orgId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),

    userId: uuid('user_id')
      .notNull()
      .references(() => usuarios.id),
    role: varchar('role', { length: 20 }).notNull(),
    permission: varchar('permission', { length: 20 }).notNull(),
    inviteStatus: varchar('invite_status', { length: 20 })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.userId] }),
  }),
);