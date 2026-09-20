import { sql } from 'drizzle-orm';
import {
  check,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { events } from './event.schema';
import { fornecedores } from './fornecedor';

/** Situações possíveis de pagamento de uma despesa/custo do evento. */
export const despesaPaymentStatus = pgEnum('despesa_payment_status', [
  'pendente',
  'pago',
  'atrasado',
  'cancelado',
]);

export type DespesaPaymentStatus =
  (typeof despesaPaymentStatus.enumValues)[number];

export const despesas = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Despesa é um sub-recurso do evento (rota aninhada /eventos/:eventId/despesas);
    // sem o evento a despesa deixa de fazer sentido isolada.
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // `restrict`: custo é registro financeiro e não pode desaparecer junto com
    // o fornecedor. A remoção de fornecedor no sistema já é lógica (deleted_at).
    fornecedorId: uuid('fornecedor_id')
      .notNull()
      .references(() => fornecedores.id, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    // `numeric` em vez de float: valor monetário não tolera o erro de
    // arredondamento binário (0.1 + 0.2 !== 0.3).
    amount: numeric('amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    costType: varchar('cost_type', { length: 100 }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    paymentStatus: despesaPaymentStatus('payment_status')
      .notNull()
      .default('pendente'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('expenses_amount_non_negative', sql`${table.amount} >= 0`),
  ],
);
