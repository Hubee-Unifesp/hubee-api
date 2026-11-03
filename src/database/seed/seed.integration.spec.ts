import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import * as bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { effectiveLevel } from '../../auth/org-access-level';
import { runSeed, type SeedDatabase } from './seed';
import { seedEvents, seedUsers, seedVenues } from './seed-data';

const options = {
  adminPassword: 'admin-senha-forte',
  userPassword: 'usuario-senha-forte',
};

describe('runSeed (banco real)', () => {
  let db: any;
  let pglite: PGlite;

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite, { schema });

    const { apply } = await pushSchema(schema as any, db);
    await apply();
  });

  afterAll(async () => {
    await pglite.close();
  });

  it('cria usuários, organização, permissões, locais, eventos e lotes', async () => {
    const summary = await runSeed(db as SeedDatabase, options);

    const ticketTypeCount = seedEvents.reduce(
      (total, event) => total + event.ticketTypes.length,
      0,
    );
    expect(summary).toEqual({
      users: seedUsers.length,
      organizations: 1,
      organizationUsers: 3,
      venues: seedVenues.length,
      events: seedEvents.length,
      organizationEvents: seedEvents.length,
      ticketTypes: ticketTypeCount,
    });
  });

  it('é idempotente: rodar de novo não cria nada', async () => {
    const summary = await runSeed(db as SeedDatabase, options);

    expect(Object.values(summary).every((count) => count === 0)).toBe(true);
    expect(await db.select().from(schema.users)).toHaveLength(seedUsers.length);
    expect(await db.select().from(schema.ticketTypes)).toHaveLength(
      seedEvents.reduce((total, event) => total + event.ticketTypes.length, 0),
    );
  });

  it('grava as senhas com hash e o papel ADMIN só no administrador', async () => {
    const [admin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@hubee.com.br'));
    const [buyer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'comprador@hubee.com.br'));

    expect(admin.role).toBe('ADMIN');
    expect(buyer.role).toBe('USER');
    expect(admin.password).not.toBe(options.adminPassword);
    expect(await bcrypt.compare(options.adminPassword, admin.password)).toBe(
      true,
    );
    expect(await bcrypt.compare(options.userPassword, buyer.password)).toBe(
      true,
    );
  });

  it('dá um nível de acesso diferente a cada membro da organização', async () => {
    const rows = await db
      .select({
        email: schema.users.email,
        role: schema.organizationUsers.role,
        permission: schema.organizationUsers.permission,
        inviteStatus: schema.organizationUsers.inviteStatus,
      })
      .from(schema.organizationUsers)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.organizationUsers.userId),
      );

    const levels = Object.fromEntries(
      rows.map(({ email, ...membership }: any) => [
        email,
        effectiveLevel(membership),
      ]),
    );
    expect(levels).toEqual({
      'organizador@hubee.com.br': 'manage',
      'equipe@hubee.com.br': 'write',
      'leitor@hubee.com.br': 'read',
    });
  });

  it('vincula todos os eventos à organização como principal', async () => {
    const [organization] = await db.select().from(schema.organizations);
    const links = await db.select().from(schema.organizationEvents);
    const eventRows = await db.select().from(schema.events);

    expect(eventRows.every((e: any) => e.organizerId === organization.id)).toBe(
      true,
    );
    expect(links).toHaveLength(seedEvents.length);
    expect(links.every((l: any) => l.role === 'main')).toBe(true);
  });
});
