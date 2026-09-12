import { pgTable, uuid, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { usuarios } from './usuario';
// TODO(GOL-35): trocar para import { organizations } from './organization.schema'
// quando a GOL-34 for mesclada em develop.

export const organizacaoUsuarios = pgTable(
  'organization_users',
  {
    // TODO(GOL-35): adicionar .references(() => organizations.id) quando a
    // GOL-34 (tabela "organizations", branch feature/GOL-34-entidade_organizacao)
    // for mesclada em develop.
    orgId: uuid('organization_id').notNull(),
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