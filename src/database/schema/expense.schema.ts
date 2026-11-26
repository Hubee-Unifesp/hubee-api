import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { suppliers } from './supplier';

/** Situações possíveis de pagamento de uma despesa/custo do evento. */
export const expensePaymentStatus = pgEnum('despesa_payment_status', [
  'pendente',
  'pago',
  'atrasado',
  'cancelado',
]);

export type ExpensePaymentStatus =
  (typeof expensePaymentStatus.enumValues)[number];

/** Grupos orçamentários de uma despesa do evento. */
export const expenseGroup = pgEnum('expense_group', [
  'fixed',
  'variable',
  'marketing',
]);

export type ExpenseGroup = (typeof expenseGroup.enumValues)[number];

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Despesa é um sub-recurso do evento (rota aninhada /events/:eventId/expenses);
    // sem o evento a despesa deixa de fazer sentido isolada.
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // `restrict`: custo é registro financeiro e não pode desaparecer junto com
    // o fornecedor. Opcional na fase de planejamento.
    supplierId: uuid('fornecedor_id').references(() => suppliers.id, {
      onDelete: 'restrict',
    }),
    description: text('description').notNull(),
    group: expenseGroup('group').notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    quantity: numeric('quantity', {
      precision: 12,
      scale: 2,
      mode: 'number',
    })
      .notNull()
      .default(1),
    unitPrice: numeric('unit_price', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    // `numeric` em vez de float: valor monetário não tolera o erro de
    // arredondamento binário (0.1 + 0.2 !== 0.3). Calculado no servidor.
    amount: numeric('amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    responsible: varchar('responsible', { length: 255 }),
    quoted: boolean('quoted').notNull().default(false),
    notes: text('notes'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    paymentStatus: expensePaymentStatus('payment_status')
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
    check('expenses_quantity_non_negative', sql`${table.quantity} >= 0`),
    check('expenses_unit_price_non_negative', sql`${table.unitPrice} >= 0`),
  ],
);
