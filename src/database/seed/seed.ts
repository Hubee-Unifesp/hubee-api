import * as bcrypt from 'bcrypt';
import { and, eq, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '../schema';
import {
  addresses,
  events,
  organizationEvents,
  organizations,
  organizationUsers,
  ticketTypes,
  users,
  venues,
} from '../schema';
import {
  seedEvents,
  seedOrganization,
  seedUsers,
  seedVenues,
  type SeedUserKey,
} from './seed-data';

/** Aceita tanto o client `node-postgres` quanto o PGlite usado nos testes. */
export type SeedDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface SeedOptions {
  adminPassword: string;
  userPassword: string;
}

/** Quantas linhas foram criadas nesta execução, por tabela. */
export interface SeedSummary {
  users: number;
  organizations: number;
  organizationUsers: number;
  venues: number;
  events: number;
  organizationEvents: number;
  ticketTypes: number;
}

/**
 * Popula o banco com os dados de `seed-data.ts`. É idempotente: cada registro
 * é buscado pela chave natural antes de inserir, então rodar de novo não
 * duplica nada nem sobrescreve o que já existe (inclusive senhas alteradas).
 * Tudo roda numa transaction: se algo falhar, nada fica pela metade.
 */
export async function runSeed(
  db: SeedDatabase,
  options: SeedOptions,
): Promise<SeedSummary> {
  const summary: SeedSummary = {
    users: 0,
    organizations: 0,
    organizationUsers: 0,
    venues: 0,
    events: 0,
    organizationEvents: 0,
    ticketTypes: 0,
  };

  const adminHash = await bcrypt.hash(options.adminPassword, 10);
  const userHash = await bcrypt.hash(options.userPassword, 10);

  await db.transaction(async (tx) => {
    const userIds = {} as Record<SeedUserKey, string>;

    for (const seedUser of seedUsers) {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, seedUser.email), isNull(users.deletedAt)));

      if (existing) {
        userIds[seedUser.key] = existing.id;
        continue;
      }

      const [created] = await tx
        .insert(users)
        .values({
          fullName: seedUser.fullName,
          email: seedUser.email,
          password: seedUser.role === 'ADMIN' ? adminHash : userHash,
          role: seedUser.role,
          signupIntent: seedUser.signupIntent,
        })
        .returning({ id: users.id });
      userIds[seedUser.key] = created.id;
      summary.users++;
    }

    let [organization] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.name, seedOrganization.name));

    if (!organization) {
      [organization] = await tx
        .insert(organizations)
        .values({
          name: seedOrganization.name,
          description: seedOrganization.description,
          representativeId: userIds[seedOrganization.representative],
        })
        .returning({ id: organizations.id });
      summary.organizations++;
    }

    for (const membership of seedOrganization.memberships) {
      const inserted = await tx
        .insert(organizationUsers)
        .values({
          orgId: organization.id,
          userId: userIds[membership.user],
          role: membership.role,
          permission: membership.permission,
          inviteStatus: seedOrganization.inviteStatus,
        })
        .onConflictDoNothing()
        .returning({ userId: organizationUsers.userId });
      summary.organizationUsers += inserted.length;
    }

    const venueIds: Record<string, string> = {};

    for (const seedVenue of seedVenues) {
      const [existing] = await tx
        .select({ id: venues.id })
        .from(venues)
        .where(eq(venues.name, seedVenue.name));

      if (existing) {
        venueIds[seedVenue.name] = existing.id;
        continue;
      }

      const [address] = await tx
        .insert(addresses)
        .values(seedVenue.address)
        .returning({ id: addresses.id });
      const [created] = await tx
        .insert(venues)
        .values({
          name: seedVenue.name,
          maxCapacity: seedVenue.maxCapacity,
          addressId: address.id,
        })
        .returning({ id: venues.id });
      venueIds[seedVenue.name] = created.id;
      summary.venues++;
    }

    for (const { ticketTypes: seedTicketTypes, ...seedEvent } of seedEvents) {
      let [event] = await tx
        .select({ id: events.id })
        .from(events)
        .where(
          and(
            eq(events.name, seedEvent.name),
            eq(events.organizerId, organization.id),
          ),
        );

      if (!event) {
        [event] = await tx
          .insert(events)
          .values({
            name: seedEvent.name,
            description: seedEvent.description,
            category: seedEvent.category,
            edition: seedEvent.edition,
            ageRating: seedEvent.ageRating,
            status: seedEvent.status,
            featured: seedEvent.featured,
            photoUrl: seedEvent.photoUrl,
            startDate: new Date(seedEvent.startDate),
            endDate: new Date(seedEvent.endDate),
            salesStartDate: new Date(seedEvent.salesStartDate),
            organizerId: organization.id,
            venueId: venueIds[seedEvent.venue],
          })
          .returning({ id: events.id });
        summary.events++;
      }

      const linked = await tx
        .insert(organizationEvents)
        .values({
          organizationId: organization.id,
          eventId: event.id,
          role: 'main',
        })
        .onConflictDoNothing()
        .returning({ eventId: organizationEvents.eventId });
      summary.organizationEvents += linked.length;

      for (const seedTicketType of seedTicketTypes) {
        const [existing] = await tx
          .select({ id: ticketTypes.id })
          .from(ticketTypes)
          .where(
            and(
              eq(ticketTypes.eventId, event.id),
              eq(ticketTypes.batch, seedTicketType.batch),
            ),
          );
        if (existing) continue;

        await tx.insert(ticketTypes).values({
          eventId: event.id,
          ...seedTicketType,
        });
        summary.ticketTypes++;
      }
    }
  });

  return summary;
}
