import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../database/schema';
import type { DrizzleDatabase } from '../database/database.provider';
import { EventRepository } from './event.repository';

describe('EventRepository (banco em memória)', () => {
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
    recifeEventId: string;
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
    const [recifeAddress] = await db
      .insert(schema.addresses)
      .values({
        zipCode: '50000-000',
        street: 'Rua do Bom Jesus',
        number: '1',
        neighborhood: 'Recife Antigo',
        city: 'Recife',
        state: 'PE',
      })
      .returning();
    const [recifeVenue] = await db
      .insert(schema.venues)
      .values({
        addressId: recifeAddress.id,
        name: 'Marco Zero',
        maxCapacity: 5000,
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

    // Evento passado: fica fora da home, mas aparece na listagem/busca.
    const [recifeEvent] = await db
      .insert(schema.events)
      .values({
        name: 'Show de Rock 100% ao vivo',
        category: 'shows',
        organizerId: organization.id,
        venueId: recifeVenue.id,
        startDate: new Date('2021-03-10T20:00:00Z'),
        endDate: new Date('2021-03-10T23:00:00Z'),
        status: 'published',
      })
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

    // Recife: o lote mais barato esgotou, sobra o Camarote.
    // Rascunho: todos os lotes esgotaram.
    const [recifeSoldOut, , draftFirst, draftSecond] = await db
      .insert(schema.ticketTypes)
      .values([
        { eventId: recifeEvent.id, batch: 'Pista', price: 40, quantity: 1 },
        { eventId: recifeEvent.id, batch: 'Camarote', price: 80, quantity: 10 },
        { eventId: draftEvent.id, batch: 'Lote 1', price: 25, quantity: 1 },
        { eventId: draftEvent.id, batch: 'Lote 2', price: 35, quantity: 1 },
      ])
      .returning();
    await db.insert(schema.tickets).values(
      [recifeSoldOut, draftFirst, draftSecond].map((ticketType) => ({
        qrCode: `sold-out-${ticketType.id}`,
        orderId: paidOrderOne.id,
        eventId: ticketType.eventId,
        ticketTypeId: ticketType.id,
        holderUserId: user.id,
      })),
    );

    fixture = {
      organizationId: organization.id,
      venueId: venue.id,
      userId: user.id,
      futureEventId: futureEvent.id,
      noLotsEventId: noLotsEvent.id,
      pastEventId: pastEvent.id,
      draftEventId: draftEvent.id,
      recifeEventId: recifeEvent.id,
    };
  });

  afterAll(async () => {
    await pglite?.close();
  });

  describe('findUpcomingSummaries()', () => {
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

  describe('findAll()', () => {
    const firstPage = { page: 1, limit: 20 };
    const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

    it('sem filtros lista tudo ordenado por data, com local, cidade e menor preço', async () => {
      const { data, total } = await repository.findAll({}, firstPage);

      expect(total).toBe(5);
      expect(ids(data)).toEqual([
        fixture.pastEventId,
        fixture.recifeEventId,
        fixture.futureEventId,
        fixture.noLotsEventId,
        fixture.draftEventId,
      ]);
      expect(data[2]).toMatchObject({
        name: 'Evento Futuro',
        status: 'published',
        venueName: 'Espaço Teste',
        venueCity: 'São Paulo',
        minPrice: 0,
        minPriceBatch: 'Lote gratuito',
      });
      expect(data[3]).toMatchObject({ minPrice: null, minPriceBatch: null });
    });

    it('menor preço ignora lote esgotado; se todos esgotaram, usa o mais barato', async () => {
      const { data } = await repository.findAll({}, firstPage);
      const byId = new Map(data.map((event) => [event.id, event]));

      expect(byId.get(fixture.recifeEventId)).toMatchObject({
        minPrice: 80,
        minPriceBatch: 'Camarote',
      });
      expect(byId.get(fixture.draftEventId)).toMatchObject({
        minPrice: 25,
        minPriceBatch: 'Lote 1',
      });
      // O lote gratuito ainda tem ingresso (1 de 50 vendido).
      expect(byId.get(fixture.futureEventId)).toMatchObject({
        minPrice: 0,
        minPriceBatch: 'Lote gratuito',
      });
    });

    it('filtra por cidade sem diferenciar maiúsculas, combinado com status', async () => {
      const { data, total } = await repository.findAll(
        { city: 'são paulo', status: 'published' },
        firstPage,
      );

      expect(total).toBe(3);
      expect(ids(data)).toEqual([
        fixture.pastEventId,
        fixture.futureEventId,
        fixture.noLotsEventId,
      ]);
    });

    it('combina cidade e categoria', async () => {
      const { data } = await repository.findAll(
        { city: 'Recife', category: 'SHOWS' },
        firstPage,
      );
      expect(ids(data)).toEqual([fixture.recifeEventId]);

      const none = await repository.findAll(
        { city: 'São Paulo', category: 'shows' },
        firstPage,
      );
      expect(none).toEqual({ data: [], total: 0 });
    });

    it('busca o termo no nome ou na descrição', async () => {
      const byDescription = await repository.findAll(
        { search: 'resumo PARA' },
        firstPage,
      );
      expect(ids(byDescription.data)).toEqual([fixture.futureEventId]);

      const byName = await repository.findAll({ search: 'rock' }, firstPage);
      expect(ids(byName.data)).toEqual([fixture.recifeEventId]);
    });

    it('trata % e _ da busca como texto literal', async () => {
      const literal = await repository.findAll({ search: '100%' }, firstPage);
      expect(ids(literal.data)).toEqual([fixture.recifeEventId]);

      const wildcard = await repository.findAll({ search: '%' }, firstPage);
      expect(ids(wildcard.data)).toEqual([fixture.recifeEventId]);

      const underscore = await repository.findAll({ search: '_' }, firstPage);
      expect(underscore.total).toBe(0);
    });

    it('filtra eventos que se sobrepõem ao período', async () => {
      const { data } = await repository.findAll(
        {
          startDate: new Date('2099-06-20T20:00:00Z'),
          endDate: new Date('2099-07-01T00:00:00Z'),
        },
        firstPage,
      );
      expect(ids(data)).toEqual([fixture.futureEventId]);

      const onlyStart = await repository.findAll(
        { startDate: new Date('2099-07-01T00:00:00Z') },
        firstPage,
      );
      expect(ids(onlyStart.data)).toEqual([
        fixture.noLotsEventId,
        fixture.draftEventId,
      ]);

      const onlyEnd = await repository.findAll(
        { endDate: new Date('2022-01-01T00:00:00Z') },
        firstPage,
      );
      expect(ids(onlyEnd.data)).toEqual([
        fixture.pastEventId,
        fixture.recifeEventId,
      ]);
    });

    it('pagina mantendo o total de resultados', async () => {
      const second = await repository.findAll({}, { page: 2, limit: 2 });
      expect(second.total).toBe(5);
      expect(ids(second.data)).toEqual([
        fixture.futureEventId,
        fixture.noLotsEventId,
      ]);

      const beyond = await repository.findAll({}, { page: 10, limit: 2 });
      expect(beyond).toEqual({ data: [], total: 5 });
    });
  });
});
