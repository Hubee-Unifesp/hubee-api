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
import { events } from './event.schema';

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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ticket_types_event_id_idx').on(table.eventId),
    check('ticket_types_price_positive', sql`${table.price} > 0`),
  ],
);
