import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { pushSchema } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import request from 'supertest';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { OrganizationService } from '../organization/organization.service';
import { StorageService } from '../storage/storage.service';
import { VenueService } from '../venue/venue.service';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';
import { PNG_SIGNATURE } from '../common/validation/image-upload';

/**
 * Eventos geridos por organizadores (GOL-144), com guard, service e repository
 * reais sobre Postgres em memória. Organização e local só precisam existir,
 * então os services deles são falsos.
 */
describe('Eventos por organizadores (banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const tokens: Record<string, string> = {};
  let orgA: string;
  let orgB: string;
  let venueId: string;
  let eventOfB: string;
  let uploads = 0;
  const deletedPhotos: string[] = [];
  const fakeStorage = {
    upload: async () =>
      `https://store.public.blob.vercel-storage.com/capa-${++uploads}.png`,
    delete: async (url: string) => {
      deletedPhotos.push(url);
    },
  };

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
    db = drizzle(pglite, { schema });
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
        { provide: StorageService, useValue: fakeStorage },
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

    const names = ['organizer', 'readOnly', 'buyer', 'admin', 'orgAdmin'];
    const users = await db
      .insert(schema.users)
      .values(
        names.map((name) => ({
          fullName: name,
          email: `${name}@example.com`,
          password: 'hash',
          role: name === 'admin' ? ('ADMIN' as const) : ('USER' as const),
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
      {
        orgId: orgA,
        userId: users[4].id,
        role: 'admin',
        permission: 'full',
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

  it('organizador cria e edita evento da própria organização, mas não cancela', async () => {
    const created = await http()
      .post('/events')
      .set(as('organizer'))
      .send(newEvent(orgA))
      .expect(201);
    expect(created.body).toMatchObject({ organizerId: orgA, status: 'draft' });

    const withoutLots = await http()
      .patch(`/events/${created.body.id}`)
      .set(as('organizer'))
      .send({ status: 'published' })
      .expect(422);
    expect(withoutLots.body.message).toBe(
      'Cadastre ao menos um lote de ingressos antes de publicar o evento',
    );

    await db
      .insert(schema.ticketTypes)
      .values({ eventId: created.body.id, batch: '1º Lote', price: 30 });

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
      .expect(403);
    await http()
      .patch(`/events/${created.body.id}`)
      .set(as('organizer'))
      .send({ status: 'cancelled' })
      .expect(403);
  });

  it('administrador da organização cancela evento por DELETE e por PATCH', async () => {
    const first = await http()
      .post('/events')
      .set(as('orgAdmin'))
      .send(newEvent(orgA))
      .expect(201);
    await http()
      .delete(`/events/${first.body.id}`)
      .set(as('orgAdmin'))
      .expect(204);

    const second = await http()
      .post('/events')
      .set(as('orgAdmin'))
      .send(newEvent(orgA))
      .expect(201);
    const cancelled = await http()
      .patch(`/events/${second.body.id}`)
      .set(as('orgAdmin'))
      .send({ status: 'cancelled' })
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
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

  describe('capa do evento', () => {
    const png = Buffer.concat([PNG_SIGNATURE, Buffer.from('imagem')]);
    const sendPhoto = (id: string, name: string) =>
      http().patch(`/events/${id}/photo`).set(as(name)).attach('file', png, {
        filename: 'capa.png',
        contentType: 'image/png',
      });

    it('organizador envia e troca a capa, e a anterior é apagada', async () => {
      const { body: event } = await http()
        .post('/events')
        .set(as('organizer'))
        .send(newEvent(orgA))
        .expect(201);

      const first = await sendPhoto(event.id, 'organizer').expect(200);
      expect(first.body.photoUrl).toMatch(/capa-\d+\.png$/);

      const second = await sendPhoto(event.id, 'organizer').expect(200);
      expect(second.body.photoUrl).not.toBe(first.body.photoUrl);
      expect(deletedPhotos).toContain(first.body.photoUrl);

      const stored = await http()
        .get(`/events/${event.id}`)
        .set(as('organizer'));
      expect(stored.body.photoUrl).toBe(second.body.photoUrl);
    });

    it('rejeita arquivo que não é imagem mesmo enviado como image/png', async () => {
      const { body: event } = await http()
        .post('/events')
        .set(as('organizer'))
        .send(newEvent(orgA))
        .expect(201);

      const response = await http()
        .patch(`/events/${event.id}/photo`)
        .set(as('organizer'))
        .attach('file', Buffer.from('GIF89a'), {
          filename: 'capa.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(response.body.message).toBe(
        'Formato inválido. Use uma imagem .jpg, .png ou .jpeg.',
      );
    });

    it('rejeita arquivo acima de 2MB e campo de texto extra antes do service', async () => {
      const { body: event } = await http()
        .post('/events')
        .set(as('organizer'))
        .send(newEvent(orgA))
        .expect(201);
      const before = uploads;

      const tooLarge = await http()
        .patch(`/events/${event.id}/photo`)
        .set(as('organizer'))
        .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), {
          filename: 'capa.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(tooLarge.body.message).toBe('A imagem deve ter no máximo 2MB.');

      await sendPhoto(event.id, 'organizer').field('extra', 'x').expect(400);
      expect(uploads).toBe(before);
    });

    it('sem token dá 401; de outra organização dá 404', async () => {
      await http().patch(`/events/${eventOfB}/photo`).expect(401);
      await sendPhoto(eventOfB, 'organizer').expect(404);
    });
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

  describe('duplicar evento', () => {
    let originalId: string;

    beforeAll(async () => {
      const [original] = await db
        .insert(schema.events)
        .values({
          ...newEvent(orgA, { name: 'Festival', category: 'shows' }),
          startDate: new Date('2026-12-10T20:00:00Z'),
          endDate: new Date('2026-12-11T02:00:00Z'),
          status: 'published',
          featured: true,
          photoUrl: 'https://store.public.blob.vercel-storage.com/festival.png',
        })
        .returning();
      originalId = original.id;
      await db.insert(schema.ticketTypes).values([
        { eventId: originalId, batch: '1º Lote', price: 40, quantity: 100 },
        { eventId: originalId, batch: '2º Lote', price: 60, quantity: 50 },
      ]);
    });

    it('organizador duplica como rascunho com os mesmos lotes, sem capa nem destaque', async () => {
      const response = await http()
        .post(`/events/${originalId}/duplicate`)
        .set(as('organizer'))
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Festival (cópia)',
        organizerId: orgA,
        category: 'shows',
        status: 'draft',
        featured: false,
        photoUrl: null,
      });
      expect(response.body.id).not.toBe(originalId);

      const lots = await db
        .select()
        .from(schema.ticketTypes)
        .where(eq(schema.ticketTypes.eventId, response.body.id));
      expect(
        lots
          .map(({ batch, price, quantity }) => ({ batch, price, quantity }))
          .sort((a, b) => a.price - b.price),
      ).toEqual([
        { batch: '1º Lote', price: 40, quantity: 100 },
        { batch: '2º Lote', price: 60, quantity: 50 },
      ]);
    });

    it('membro só leitura recebe 403; de outra organização dá 404', async () => {
      await http()
        .post(`/events/${originalId}/duplicate`)
        .set(as('readOnly'))
        .expect(403);
      await http()
        .post(`/events/${eventOfB}/duplicate`)
        .set(as('organizer'))
        .expect(404);
    });
  });

  it('listagem traz capacidade e ingressos vendidos de cada evento', async () => {
    const [event] = await db
      .insert(schema.events)
      .values({
        ...newEvent(orgA, { name: 'Com capacidade' }),
        startDate: new Date('2026-12-10T20:00:00Z'),
        endDate: new Date('2026-12-11T02:00:00Z'),
      })
      .returning();
    await db.insert(schema.ticketTypes).values([
      { eventId: event.id, batch: 'A', price: 10, quantity: 30 },
      { eventId: event.id, batch: 'B', price: 20, quantity: 20 },
    ]);

    const response = await http()
      .get(`/events?organizerId=${orgA}&search=Com%20capacidade`)
      .set(as('organizer'))
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({ id: event.id, capacity: 50, ticketsSold: 0 }),
    ]);
  });

  it('PATCH com null apaga os campos opcionais do evento', async () => {
    const { body: event } = await http()
      .post('/events')
      .set(as('organizer'))
      .send(
        newEvent(orgA, {
          description: 'Descrição',
          category: 'festas',
          edition: '2ª',
          ageRating: '18',
          salesStartDate: '2026-11-20T12:00:00Z',
        }),
      )
      .expect(201);

    const cleared = await http()
      .patch(`/events/${event.id}`)
      .set(as('organizer'))
      .send({
        description: null,
        category: null,
        edition: null,
        ageRating: null,
        salesStartDate: null,
      })
      .expect(200);

    expect(cleared.body).toMatchObject({
      description: null,
      category: null,
      edition: null,
      ageRating: null,
      salesStartDate: null,
    });
  });

  it.each([
    'name',
    'venueId',
    'startDate',
    'endDate',
    'status',
    'featured',
  ])('PATCH com %s null responde 400', async (field) => {
    const { body: event } = await http()
      .post('/events')
      .set(as('organizer'))
      .send(newEvent(orgA))
      .expect(201);

    await http()
      .patch(`/events/${event.id}`)
      .set(as('organizer'))
      .send({ [field]: null })
      .expect(400);
  });
});
