import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import request from 'supertest';
import { AddressRepository } from '../address/address.repository';
import { AddressService } from '../address/address.service';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { VenueController } from './venue.controller';
import { VenueRepository } from './venue.repository';
import { VenueService } from './venue.service';

/**
 * Locais geridos por organizadores (GOL-206), com guard, service e repository
 * reais sobre Postgres em memória (PGlite).
 */
describe('Locais por organizadores (banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });
  const newVenue = (name = 'Espaço Cultural') => ({
    name,
    maxCapacity: 400,
    address: {
      zipCode: '12200-000',
      street: 'Av. São João',
      number: '200',
      neighborhood: 'Jardim Aquarius',
      city: 'São José dos Campos',
      state: 'SP',
    },
  });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [VenueController],
      providers: [
        VenueService,
        VenueRepository,
        AddressService,
        AddressRepository,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const [{ id: orgId }] = await db
      .insert(schema.organizations)
      .values({ name: 'Atlética' })
      .returning();

    const names = ['organizer', 'orgAdmin', 'readOnly', 'buyer', 'admin'];
    const users = await db
      .insert(schema.users)
      .values(
        names.map((name) => ({
          fullName: name,
          email: `${name}@example.com`,
          password: 'hash',
          role: name === 'admin' ? 'ADMIN' : 'USER',
        })),
      )
      .returning();

    await db.insert(schema.organizationUsers).values([
      {
        orgId,
        userId: users[0].id,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId,
        userId: users[1].id,
        role: 'admin',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId,
        userId: users[2].id,
        role: 'member',
        permission: 'read_only',
        inviteStatus: 'accepted',
      },
    ]);

    const jwt = module.get(JwtService);
    for (const user of users)
      tokens[user.fullName] = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  it.each(['organizer', 'orgAdmin'])(
    'organizador (%s) cadastra, edita e consulta local, mas não exclui',
    async (userName) => {
      const created = await http()
        .post('/venues')
        .set(as(userName))
        .send(newVenue(`Arena ${userName}`))
        .expect(201);
      expect(created.body).toMatchObject({
        name: `Arena ${userName}`,
        maxCapacity: 400,
        address: expect.objectContaining({
          city: 'São José dos Campos',
          state: 'SP',
        }),
      });

      const updated = await http()
        .patch(`/venues/${created.body.id}`)
        .set(as(userName))
        .send({ maxCapacity: 600 })
        .expect(200);
      expect(updated.body.maxCapacity).toBe(600);

      const listed = await http().get('/venues').expect(200);
      expect(listed.body.map((v: { id: string }) => v.id)).toContain(
        created.body.id,
      );

      await http()
        .delete(`/venues/${created.body.id}`)
        .set(as(userName))
        .expect(403);
    },
  );

  it.each(['readOnly', 'buyer'])(
    'usuário sem nível write (%s) recebe 403 ao cadastrar ou editar local',
    async (userName) => {
      const { body: venue } = await http()
        .post('/venues')
        .set(as('organizer'))
        .send(newVenue('Ginásio Central'))
        .expect(201);

      await http()
        .post('/venues')
        .set(as(userName))
        .send(newVenue('Bloqueado'))
        .expect(403);
      await http()
        .patch(`/venues/${venue.id}`)
        .set(as(userName))
        .send({ name: 'Alterado' })
        .expect(403);
    },
  );

  it('ADMIN global pode excluir local sem eventos futuros', async () => {
    const { body: venue } = await http()
      .post('/venues')
      .set(as('admin'))
      .send(newVenue('Local Temporário'))
      .expect(201);

    await http().delete(`/venues/${venue.id}`).set(as('admin')).expect(204);
  });
});
