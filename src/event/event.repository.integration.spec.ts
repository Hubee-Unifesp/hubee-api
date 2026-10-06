import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../database/schema';
import type { DrizzleDatabase } from '../database/database.provider';
import { EventRepository } from './event.repository';

describe('EventRepository.findUpcomingSummaries (banco em memória)', () => {
  let pglite: PGlite;
  let repository: EventRepository;
  let fixture: {
    organizationId: string;
    venueId: string;
    userId: string;
    futureEventId: string;
    noLotsEventId: string;
    pastEventId: string;
    draftEventId: string;
  };

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db);
    await apply();
    repository = new EventRepository(db as unknown as DrizzleDatabase);

    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: 'Produtora Teste' })
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
    const [venue] = await db
      .insert(schema.venues)
      .values({
        addressId: address.id,
        name: 'Espaço Teste',
        maxCapacity: 999,
      })
      .returning();
    const [user] = await db
      .insert(schema.users)
      .values({
        fullName: 'Pessoa Teste',
        email: 'event-summary@example.com',
        password: 'hashed-password',
      })
      .returning();

    const [futureEvent, noLotsEvent, pastEvent, draftEvent] = await db
      .insert(schema.events)
      .values([
        {
          name: 'Evento Futuro',
          description: 'Resumo para home',
          category: 'Música',
          organizerId: organization.id,
          venueId: venue.id,
          startDate: new Date('2099-06-20T18:00:00Z'),
          endDate: new Date('2099-06-20T23:00:00Z'),
          status: 'published',
          featured: true,
        },
        {
          name: 'Evento Sem Lotes',
          organizerId: organization.id,
          venueId: venue.id,
          startDate: new Date('2099-07-20T18:00:00Z'),
          endDate: new Date('2099-07-20T23:00:00Z'),
          status: 'published',
        },
        {
          name: 'Evento Passado',
          organizerId: organization.id,
          venueId: venue.id,
          startDate: new Date('2020-06-20T18:00:00Z'),
          endDate: new Date('2020-06-20T23:00:00Z'),
          status: 'published',
        },
        {
          name: 'Evento Não Publicado',
          organizerId: organization.id,
          venueId: venue.id,
          startDate: new Date('2099-08-20T18:00:00Z'),
          endDate: new Date('2099-08-20T23:00:00Z'),
          status: 'draft',
        },
      ])
      .returning();

    const [freeBatch, paidBatch] = await db
      .insert(schema.ticketTypes)
      .values([
        {
          eventId: futureEvent.id,
          batch: 'Lote gratuito',
          price: 0,
          quantity: 50,
        },
        {
          eventId: futureEvent.id,
          batch: 'Lote pago',
          price: 100,
          quantity: 150,
        },
      ])
      .returning();

    const [paidOrderOne, paidOrderTwo, pendingOrder] = await db
      .insert(schema.orders)
      .values([
        { userId: user.id, totalAmount: 0, status: 'pago' },
        { userId: user.id, totalAmount: 100, status: 'pago' },
        { userId: user.id, totalAmount: 100, status: 'pendente' },
      ])
      .returning();

    await db.insert(schema.tickets).values([
      {
        qrCode: 'paid-ticket-1',
        orderId: paidOrderOne.id,
        eventId: futureEvent.id,
        ticketTypeId: freeBatch.id,
        holderUserId: user.id,
      },
      {
        qrCode: 'paid-ticket-2',
        orderId: paidOrderTwo.id,
        eventId: futureEvent.id,
        ticketTypeId: paidBatch.id,
        holderUserId: user.id,
      },
      {
        qrCode: 'pending-ticket',
        orderId: pendingOrder.id,
        eventId: futureEvent.id,
        ticketTypeId: paidBatch.id,
        holderUserId: user.id,
      },
    ]);

    fixture = {
      organizationId: organization.id,
      venueId: venue.id,
      userId: user.id,
      futureEventId: futureEvent.id,
      noLotsEventId: noLotsEvent.id,
      pastEventId: pastEvent.id,
      draftEventId: draftEvent.id,
    };
  });

  afterAll(async () => {
    await pglite?.close();
  });

  it('returns published future events and calculates their summaries', async () => {
    const result = await repository.findUpcomingSummaries();

    expect(result).toHaveLength(2);
    expect(result.map((event) => event.id)).toEqual([
      fixture.futureEventId,
      fixture.noLotsEventId,
    ]);
    expect(result[0]).toMatchObject({
      name: 'Evento Futuro',
      description: 'Resumo para home',
      category: 'Música',
      featured: true,
      organizerName: 'Produtora Teste',
      venueName: 'Espaço Teste',
      venueCity: 'São Paulo',
      minPrice: 0,
      minPriceBatch: 'Lote gratuito',
      capacity: 200,
      ticketsSold: 2,
    });
    expect(result[1]).toMatchObject({
      name: 'Evento Sem Lotes',
      minPrice: null,
      minPriceBatch: null,
      capacity: 0,
      ticketsSold: 0,
    });
    expect(result.map((event) => event.id)).not.toContain(
      fixture.pastEventId,
    );
    expect(result.map((event) => event.id)).not.toContain(
      fixture.draftEventId,
    );
  });
});