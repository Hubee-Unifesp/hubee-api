import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import request from 'supertest';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { OrganizationService } from '../organization/organization.service';
import { VenueService } from '../venue/venue.service';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

/**
 * Eventos geridos por organizadores (GOL-144), com guard, service e repository
 * reais sobre Postgres em memória. Organização e local só precisam existir,
 * então os services deles são falsos.
 */
describe('Eventos por organizadores (banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};
  let orgA: string;
  let orgB: string;
  let venueId: string;
  let eventOfB: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });
  const newEvent = (organizerId: string, extra: object = {}) => ({
    name: 'Calourada',
    organizerId,
    venueId,
    startDate: '2026-12-10T20:00:00Z',
    endDate: '2026-12-11T02:00:00Z',
    ...extra,
  });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [EventController],
      providers: [
        EventService,
        EventRepository,
        { provide: DRIZZLE, useValue: db },
        {
          provide: OrganizationService,
          useValue: { findOne: async () => ({}) },
        },
        { provide: VenueService, useValue: { findOne: async () => ({}) } },
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

    [{ id: orgA }, { id: orgB }] = await db
      .insert(schema.organizations)
      .values([{ name: 'Atlética' }, { name: 'Bateria' }])
      .returning();
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
    [{ id: venueId }] = await db
      .insert(schema.venues)
      .values({ addressId: address.id, name: 'Ginásio', maxCapacity: 500 })
      .returning();

    const names = ['organizer', 'readOnly', 'buyer', 'admin'];
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
        orgId: orgA,
        userId: users[0].id,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgA,
        userId: users[1].id,
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

    [{ id: eventOfB }] = await db
      .insert(schema.events)
      .values({
        ...newEvent(orgB),
        startDate: new Date('2026-12-10T20:00:00Z'),
        endDate: new Date('2026-12-11T02:00:00Z'),
      })
      .returning();
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  it('organizador cria, edita e cancela evento da própria organização', async () => {
    const created = await http()
      .post('/events')
      .set(as('organizer'))
      .send(newEvent(orgA))
      .expect(201);
    expect(created.body).toMatchObject({ organizerId: orgA, status: 'draft' });

    const updated = await http()
      .patch(`/events/${created.body.id}`)
      .set(as('organizer'))
      .send({ name: 'Calourada 2026', status: 'published' })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Calourada 2026',
      status: 'published',
    });

    await http()
      .delete(`/events/${created.body.id}`)
      .set(as('organizer'))
      .expect(204);
  });

  it('comprador sem vínculo recebe 403 ao criar evento', async () => {
    await http()
      .post('/events')
      .set(as('buyer'))
      .send(newEvent(orgA))
      .expect(403);
  });

  it('organizador não cria evento em nome de outra organização', async () => {
    await http()
      .post('/events')
      .set(as('organizer'))
      .send(newEvent(orgB))
      .expect(403);
  });

  it('membro só leitura recebe 403 ao criar evento', async () => {
    await http()
      .post('/events')
      .set(as('readOnly'))
      .send(newEvent(orgA))
      .expect(403);
  });

  it('organizador recebe 404 ao alterar ou cancelar evento de outra organização', async () => {
    await http()
      .patch(`/events/${eventOfB}`)
      .set(as('organizer'))
      .send({ name: 'Invadido' })
      .expect(404);
    await http().delete(`/events/${eventOfB}`).set(as('organizer')).expect(404);
  });

  it('organizador não pode destacar o evento na home', async () => {
    await http()
      .post('/events')
      .set(as('organizer'))
      .send(newEvent(orgA, { featured: true }))
      .expect(403);
  });

  it('ADMIN cria evento destacado para qualquer organização', async () => {
    const response = await http()
      .post('/events')
      .set(as('admin'))
      .send(newEvent(orgB, { featured: true }))
      .expect(201);
    expect(response.body.featured).toBe(true);
  });

  describe('rascunhos', () => {
    let draftId: string;

    beforeAll(async () => {
      const response = await http()
        .post('/events')
        .set(as('organizer'))
        .send(newEvent(orgA, { name: 'Rascunho da Atlética' }))
        .expect(201);
      draftId = response.body.id;
    });

    it.each(['organizer', 'readOnly'])(
      'membro (%s) lista os rascunhos da organização com ?organizerId',
      async (name) => {
        const response = await http()
          .get(`/events?organizerId=${orgA}`)
          .set(as(name))
          .expect(200);
        expect(response.body.data.map((e: { id: string }) => e.id)).toContain(
          draftId,
        );
      },
    );

    it('quem não é membro só vê os publicados da organização', async () => {
      const response = await http()
        .get(`/events?organizerId=${orgA}`)
        .set(as('buyer'))
        .expect(200);
      expect(
        response.body.data.every(
          (e: { status: string }) => e.status === 'published',
        ),
      ).toBe(true);
    });

    it('membro abre o rascunho; quem não é membro recebe 404', async () => {
      await http().get(`/events/${draftId}`).set(as('readOnly')).expect(200);
      await http().get(`/events/${draftId}`).set(as('buyer')).expect(404);
      await http().get(`/events/${draftId}`).expect(404);
    });
  });
});
