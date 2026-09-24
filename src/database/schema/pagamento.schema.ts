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

/** Métodos de pagamento aceitos pelo sistema. */
export const pagamentoMetodo = pgEnum('pagamento_metodo', [
  'cartao_credito',
  'cartao_debito',
  'pix',
  'boleto',
  'transferencia',
]);

export type PagamentoMetodo = (typeof pagamentoMetodo.enumValues)[number];

/** Situações possíveis de um pagamento no fluxo de confirmação. */
export const pagamentoStatus = pgEnum('pagamento_status', [
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
    // `unique` garante a relação 1:1 com o pedido: um pedido só pode ter um
    // pagamento. `restrict` mantém o registro financeiro auditável mesmo que
    // o pedido seja cancelado.
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'restrict' }),
    metodoPagamento: pagamentoMetodo('metodo_pagamento').notNull(),
    status: pagamentoStatus('status').notNull().default('pendente'),
    // `numeric` em vez de float: valor monetário não tolera o erro de
    // arredondamento binário (0.1 + 0.2 !== 0.3).
    valorPago: numeric('valor_pago', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    dataPagamento: timestamp('data_pagamento', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('pagamentos_valor_pago_non_negative', sql`${table.valorPago} >= 0`),
  ],
);
