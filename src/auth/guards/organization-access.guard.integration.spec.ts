import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import { OrgAccess } from '../decorators/org-access.decorator';
import * as schema from '../../database/schema';
import type { DrizzleDatabase } from '../../database/database.provider';
import { OrganizationAccessGuard } from './organization-access.guard';

class Routes {
  @OrgAccess('write')
  write() {}

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  writeByEvent() {}
}

/** Valida os filtros reais do guard (vínculo aceito, por usuário e organização). */
describe('OrganizationAccessGuard (banco em memória)', () => {
  let pglite: PGlite;
  let guard: OrganizationAccessGuard;
  let organizationId: string;
  let otherOrganizationId: string;
  let eventId: string;
  const userIds: Record<string, string> = {};

  const canWrite = (userName: string, orgId = organizationId) =>
    guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: userIds[userName], email: 'x@example.com', role: 'USER' },
          params: { orgId },
        }),
      }),
      getHandler: () => Routes.prototype.write,
      getClass: () => Routes,
    } as unknown as ExecutionContext);

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();
    guard = new OrganizationAccessGuard(
      new Reflector(),
      db as unknown as DrizzleDatabase,
    );

    const [organization, otherOrganization] = await db
      .insert(schema.organizations)
      .values([{ name: 'Produtora A' }, { name: 'Produtora B' }])
      .returning();
    organizationId = organization.id;
    otherOrganizationId = otherOrganization.id;

    const names = ['full', 'readOnly', 'pending', 'rejected', 'stranger'];
    const users = await db
      .insert(schema.users)
      .values(
        names.map((name) => ({
          fullName: name,
          email: `${name}@example.com`,
          password: 'hashed-password',
        })),
      )
      .returning();
    names.forEach((name, index) => (userIds[name] = users[index].id));

    const link = (name: string, permission: string, inviteStatus: string) => ({
      orgId: organizationId,
      userId: userIds[name],
      role: 'member',
      permission,
      inviteStatus,
    });
    await db
      .insert(schema.organizationUsers)
      .values([
        link('full', 'full', 'accepted'),
        link('readOnly', 'read_only', 'accepted'),
        link('pending', 'full', 'pending'),
        link('rejected', 'full', 'rejected'),
      ]);

    const [address] = await db
      .insert(schema.addresses)
      .values({
        zipCode: '01000-000',
        street: 'Rua de Teste',
        number: '10',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
      })
      .returning();
    const [venue] = await db
      .insert(schema.venues)
      .values({ addressId: address.id, name: 'Espaço Teste', maxCapacity: 100 })
      .returning();
    const [event] = await db
      .insert(schema.events)
      .values({
        name: 'Evento Teste',
        organizerId: organizationId,
        venueId: venue.id,
        startDate: new Date('2099-06-20T18:00:00Z'),
        endDate: new Date('2099-06-20T23:00:00Z'),
      })
      .returning();
    eventId = event.id;
  });

  afterAll(async () => {
    await pglite?.close();
  });

  it('@OrgAccess("write") libera membro aceito com permission = full', async () => {
    await expect(canWrite('full')).resolves.toBe(true);
  });

  it.each(['readOnly', 'pending', 'rejected', 'stranger'])(
    '@OrgAccess("write") recusa %s com 403',
    async (userName) => {
      await expect(canWrite(userName)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it('o vínculo de uma organização não vale em outra', async () => {
    await expect(canWrite('full', otherOrganizationId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('resolve a organização pelo evento (events.organizer_id)', async () => {
    const context = (userName: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: userIds[userName], email: 'x', role: 'USER' },
            params: { eventId },
          }),
        }),
        getHandler: () => Routes.prototype.writeByEvent,
        getClass: () => Routes,
      }) as unknown as ExecutionContext;

    await expect(guard.canActivate(context('full'))).resolves.toBe(true);
    await expect(guard.canActivate(context('pending'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
