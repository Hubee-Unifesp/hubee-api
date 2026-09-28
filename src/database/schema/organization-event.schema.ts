import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { events } from './event.schema';
import { organizations } from './organization.schema';

export const organizationEventRole = pgEnum('organization_event_role', [
  'main',
  'co_organizer',
  'supporter',
]);

export type OrganizationEventRole =
  (typeof organizationEventRole.enumValues)[number];

export const organizationEvents = pgTable(
  'organization_events',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    role: organizationEventRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.eventId] }),
    index('organization_events_event_id_idx').on(table.eventId),
    index('organization_events_organization_id_idx').on(table.organizationId),
  ],
);
