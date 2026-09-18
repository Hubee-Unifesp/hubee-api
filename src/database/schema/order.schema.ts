import { sql } from 'drizzle-orm';
import {
  check,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { usuarios } from './user';

/** Situações possíveis de um pedido no fluxo de compra. */
export const orderStatus = pgEnum('order_status', [
  'pendente',
  'pago',
  'cancelado',
]);

export type OrderStatus = (typeof orderStatus.enumValues)[number];

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // `restrict`: o pedido é registro financeiro e não pode desaparecer junto
    // com o usuário. A exclusão de usuário no sistema é lógica (deleted_at).
    userId: uuid('user_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    status: orderStatus('status').notNull().default('pendente'),
    // `numeric` em vez de float: valor monetário não tolera o erro de
    // arredondamento binário (0.1 + 0.2 !== 0.3).
    totalAmount: numeric('total_amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('orders_total_amount_non_negative', sql`${table.totalAmount} >= 0`),
  ],
);
