import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { events } from './event.schema';

export const ticketTypeModality = pgEnum('ticket_type_modality', [
  'inteira',
  'meia',
  'estudante',
  'vip',
  'cortesia',
]);

export type TicketTypeModality = (typeof ticketTypeModality.enumValues)[number];

export const ticketTypes = pgTable(
  'ticket_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // `cascade`: um tipo de ingresso só existe dentro do evento que o define.
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    batch: varchar('batch', { length: 100 }).notNull(),
    // `numeric` em vez de float: valor monetário não tolera o erro de
    // arredondamento binário (0.1 + 0.2 !== 0.3).
    price: numeric('price', {
      precision: 12,
      scale: 2,
      mode: 'number',
    }).notNull(),
    quantity: integer('quantity').notNull().default(0),
    modality: ticketTypeModality('modality').notNull().default('inteira'),
    // Janela de vendas do lote; `null` deixa o lote seguir a janela do evento.
    salesStartDate: timestamp('sales_start_date', { withTimezone: true }),
    salesEndDate: timestamp('sales_end_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ticket_types_event_id_idx').on(table.eventId),
    check('ticket_types_price_positive', sql`${table.price} >= 0`),
  ],
);

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, {
    fields: [ticketTypes.eventId],
    references: [events.id],
  }),
}));
