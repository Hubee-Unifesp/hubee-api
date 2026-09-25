import { sql } from 'drizzle-orm';
import {
  check,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { orders } from './order.schema';

export const pagamentoMetodo = pgEnum('payment_method', [
  'cartao_credito',
  'cartao_debito',
  'pix',
  'boleto',
  'transferencia',
]);

export type PagamentoMetodo = (typeof pagamentoMetodo.enumValues)[number];

export const pagamentoStatus = pgEnum('payment_status', [
  'pendente',
  'confirmado',
  'recusado',
  'estornado',
]);

export type PagamentoStatus = (typeof pagamentoStatus.enumValues)[number];

export const pagamentos = pgTable(
  'pagamentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'restrict' }),
    paymentMethod: pagamentoMetodo('payment_method').notNull(),
    status: pagamentoStatus('status').notNull().default('pendente'),
    amount: numeric('amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('pagamentos_amount_non_negative', sql`${table.amount} >= 0`),
  ],
);