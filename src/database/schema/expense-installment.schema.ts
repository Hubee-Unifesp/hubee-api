import { sql } from 'drizzle-orm';
import {
  check,
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { expensePaymentStatus, expenses } from './expense.schema';

export const expenseInstallments = pgTable(
  'expense_installments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    amount: numeric('amount', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    status: expensePaymentStatus('status').notNull().default('pendente'),
    paidBy: varchar('paid_by', { length: 255 }),
    paymentMethod: varchar('payment_method', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('expense_installments_expense_id_idx').on(table.expenseId),
    check('expense_installments_amount_positive', sql`${table.amount} > 0`),
  ],
);
