import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { events } from './event.schema';
import { orders } from './order.schema';
import { ticketTypes } from './ticket-type.schema';
import { usuarios } from './user';

/** Situações de um ingresso: emitido no pedido, usado no check-in ou cancelado. */
export const ticketStatus = pgEnum('ticket_status', [
  'emitido',
  'usado',
  'cancelado',
]);

export type TicketStatus = (typeof ticketStatus.enumValues)[number];

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Valor que o check-in lê. Único: dois ingressos com o mesmo código
    // deixariam a validação na portaria ambígua.
    qrCode: varchar('qr_code', { length: 64 }).notNull().unique(),
    // As FKs abaixo usam `restrict`: ingresso é registro de venda e não pode
    // sumir junto com o pedido, o evento, o tipo ou o titular. A exclusão de
    // usuário e de pedido no sistema é lógica; o cancelamento é pelo status.
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    ticketTypeId: uuid('ticket_type_id')
      .notNull()
      .references(() => ticketTypes.id, { onDelete: 'restrict' }),
    holderUserId: uuid('holder_user_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'restrict' }),
    status: ticketStatus('status').notNull().default('emitido'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('tickets_order_id_idx').on(table.orderId),
    index('tickets_event_id_idx').on(table.eventId),
    index('tickets_ticket_type_id_idx').on(table.ticketTypeId),
    index('tickets_holder_user_id_idx').on(table.holderUserId),
  ],
);
