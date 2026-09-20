import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './organization.schema';
import { venues } from './venue.schema';

export const eventStatus = pgEnum('event_status', [
  'draft',
  'published',
  'finished',
  'cancelled',
]);

export type EventStatus = (typeof eventStatus.enumValues)[number];

export const eventAgeRating = pgEnum('event_age_rating', [
  'L',
  '10',
  '12',
  '14',
  '16',
  '18',
]);

export type EventAgeRating = (typeof eventAgeRating.enumValues)[number];

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    ageRating: eventAgeRating('age_rating'),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id, { onDelete: 'restrict' }),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    salesStartDate: timestamp('sales_start_date', { withTimezone: true }),
    status: eventStatus('status').notNull().default('draft'),
    category: varchar('category', { length: 100 }),
    edition: varchar('edition', { length: 100 }),
    photoUrl: varchar('photo_url', { length: 2048 }),
    featured: boolean('featured').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('events_end_after_start', sql`${table.endDate} > ${table.startDate}`),
    check(
      'events_sales_start_before_event',
      sql`${table.salesStartDate} <= ${table.startDate}`,
    ),
  ],
);
