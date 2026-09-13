import { pgTable, uuid, varchar, timestamp, date } from 'drizzle-orm/pg-core';
export const usuarios = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  primeiroNome: varchar('first_name', { length: 100 }).notNull(),
  sobrenome: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  telefone: varchar('phone', { length: 20 }),
  senha: varchar('password', { length: 255 }).notNull(),
  cpf: varchar('cpf', { length: 11 }).notNull().unique(),
  dataNascimento: date('birth_date').notNull(),
  tipoPerfil: varchar('profile_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).default('ATIVO'),
  dataCriacao: timestamp('created_at').defaultNow(),
  dataModificacao: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});
