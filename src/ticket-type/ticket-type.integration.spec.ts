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
import { EventRepository } from '../event/event.repository';
import { EventService } from '../event/event.service';
import { OrganizationService } from '../organization/organization.service';
import { StorageService } from '../storage/storage.service';
import { VenueService } from '../venue/venue.service';
import { TicketTypeController } from './ticket-type.controller';
import { TicketTypeRepository } from './ticket-type.repository';
import { TicketTypeService } from './ticket-type.service';

/**
 * Lotes de ingressos geridos por organizadores (GOL-206), com guard, service e
 * repository reais sobre Postgres em memória (PGlite).
 */
describe('Lotes de ingressos por organizadores (banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};
  let orgA: string;
  let orgB: string;
  let eventOfA: string;
  let eventOfB: string;
  let lotOfB: string;
  let cancelledEventOfA: string;
  let lotOfCancelled: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });
  const newLot = (batch = '1º Lote') => ({
    batch,
    price: 50,
    quantity: 100,
  });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [TicketTypeController],
      providers: [
        TicketTypeService,
        TicketTypeRepository,
        EventService,
        EventRepository,
        { provide: DRIZZLE, useValue: db },
        {
          provide: OrganizationService,
          useValue: { findOne: async () => ({}) },
        },
        { provide: VenueService, useValue: { findOne: async () => ({}) } },
        {
          provide: StorageService,
          useValue: { upload: async () => '', delete: async () => undefined },
        },
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
    const [{ id: venueId }] = await db
      .insert(schema.venues)
      .values({ addressId: address.id, name: 'Ginásio', maxCapacity: 500 })
      .returning();

    [{ id: eventOfA }, { id: eventOfB }, { id: cancelledEventOfA }] = await db
      .insert(schema.events)
      .values([
        {
          name: 'Festa da Atlética',
          organizerId: orgA,
          venueId,
          startDate: new Date('2026-12-10T20:00:00Z'),
          endDate: new Date('2026-12-11T02:00:00Z'),
          status: 'published',
        },
        {
          name: 'Festa da Bateria',
          organizerId: orgB,
          venueId,
          startDate: new Date('2026-12-12T20:00:00Z'),
          endDate: new Date('2026-12-13T02:00:00Z'),
          status: 'published',
        },
        {
          name: 'Festa Cancelada',
          organizerId: orgA,
          venueId,
          startDate: new Date('2026-12-14T20:00:00Z'),
          endDate: new Date('2026-12-15T02:00:00Z'),
          status: 'cancelled',
        },
      ])
      .returning();

    [{ id: lotOfCancelled }] = await db
      .insert(schema.ticketTypes)
      .values({ eventId: cancelledEventOfA, batch: 'Lote C', price: 20 })
      .returning();

    [{ id: lotOfB }] = await db
      .insert(schema.ticketTypes)
      .values({
        eventId: eventOfB,
        batch: 'Lote B',
        price: '40.00',
        quantity: 80,
      })
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
        orgId: orgA,
        userId: users[0].id,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgA,
        userId: users[1].id,
        role: 'admin',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgA,
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
    'membro (%s) com nível write/manage cria, edita e remove lote do evento da sua organização',
    async (userName) => {
      const created = await http()
        .post(`/events/${eventOfA}/ticket-types`)
        .set(as(userName))
        .send(newLot(`Lote ${userName}`))
        .expect(201);
      expect(created.body).toMatchObject({
        eventId: eventOfA,
        batch: `Lote ${userName}`,
        price: 50,
        quantity: 100,
      });

      const updated = await http()
        .patch(`/events/${eventOfA}/ticket-types/${created.body.id}`)
        .set(as(userName))
        .send({ price: 75, quantity: 120 })
        .expect(200);
      expect(updated.body).toMatchObject({ price: 75, quantity: 120 });

      await http()
        .delete(`/events/${eventOfA}/ticket-types/${created.body.id}`)
        .set(as(userName))
        .expect(204);
    },
  );

  it('membro read_only recebe 403 ao criar, editar ou remover lote', async () => {
    const { body: lot } = await http()
      .post(`/events/${eventOfA}/ticket-types`)
      .set(as('organizer'))
      .send(newLot('Lote Protegido'))
      .expect(201);

    await http()
      .post(`/events/${eventOfA}/ticket-types`)
      .set(as('readOnly'))
      .send(newLot())
      .expect(403);
    await http()
      .patch(`/events/${eventOfA}/ticket-types/${lot.id}`)
      .set(as('readOnly'))
      .send({ price: 90 })
      .expect(403);
    await http()
      .delete(`/events/${eventOfA}/ticket-types/${lot.id}`)
      .set(as('readOnly'))
      .expect(403);
  });

  it.each(['buyer', 'organizer'])(
    'usuário sem vínculo com a organização dona do evento (%s) recebe 404',
    async (userName) => {
      await http()
        .post(`/events/${eventOfB}/ticket-types`)
        .set(as(userName))
        .send(newLot())
        .expect(404);
      await http()
        .patch(`/events/${eventOfB}/ticket-types/${lotOfB}`)
        .set(as(userName))
        .send({ price: 60 })
        .expect(404);
      await http()
        .delete(`/events/${eventOfB}/ticket-types/${lotOfB}`)
        .set(as(userName))
        .expect(404);
    },
  );

  it('ADMIN global gerencia lotes de qualquer organização', async () => {
    const created = await http()
      .post(`/events/${eventOfB}/ticket-types`)
      .set(as('admin'))
      .send(newLot('Lote Admin'))
      .expect(201);

    await http()
      .patch(`/events/${eventOfB}/ticket-types/${created.body.id}`)
      .set(as('admin'))
      .send({ price: 80 })
      .expect(200);
    await http()
      .delete(`/events/${eventOfB}/ticket-types/${created.body.id}`)
      .set(as('admin'))
      .expect(204);
  });

  it('recusa com 422 criar, editar ou remover lote de evento cancelado', async () => {
    await http()
      .post(`/events/${cancelledEventOfA}/ticket-types`)
      .set(as('organizer'))
      .send(newLot())
      .expect(422);
    await http()
      .patch(`/events/${cancelledEventOfA}/ticket-types/${lotOfCancelled}`)
      .set(as('organizer'))
      .send({ price: 90 })
      .expect(422);
    await http()
      .delete(`/events/${cancelledEventOfA}/ticket-types/${lotOfCancelled}`)
      .set(as('organizer'))
      .expect(422);
  });

  it('grava modalidade e janela de vendas do lote e apaga a janela com null', async () => {
    const created = await http()
      .post(`/events/${eventOfA}/ticket-types`)
      .set(as('organizer'))
      .send({
        ...newLot('Meia'),
        modality: 'meia',
        salesStartDate: '2026-11-01T12:00:00.000Z',
        salesEndDate: '2026-12-01T12:00:00.000Z',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      modality: 'meia',
      salesStartDate: '2026-11-01T12:00:00.000Z',
      salesEndDate: '2026-12-01T12:00:00.000Z',
    });

    const cleared = await http()
      .patch(`/events/${eventOfA}/ticket-types/${created.body.id}`)
      .set(as('organizer'))
      .send({ salesStartDate: null, salesEndDate: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      modality: 'meia',
      salesStartDate: null,
      salesEndDate: null,
    });

    await http()
      .post(`/events/${eventOfA}/ticket-types`)
      .set(as('organizer'))
      .send({ ...newLot(), modality: 'vip-plus' })
      .expect(400);
  });
});
