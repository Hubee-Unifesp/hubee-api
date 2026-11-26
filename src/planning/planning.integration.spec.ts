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
import { NotificationsRepository } from '../notifications/notifications.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationService } from '../organization/organization.service';
import { StorageService } from '../storage/storage.service';
import { VenueService } from '../venue/venue.service';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

describe('Resumo financeiro do planejamento (GOL-297, banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};
  let eventOfA: string;
  let emptyEventOfA: string;
  let eventOfB: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });
  const summaryOf = (eventId: string, query = '') =>
    `/events/${eventId}/planning/summary${query}`;

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [PlanningController],
      providers: [
        PlanningService,
        PlanningRepository,
        EventService,
        EventRepository,
        NotificationsRepository,
        NotificationsService,
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

    const [orgA, orgB] = await db
      .insert(schema.organizations)
      .values([{ name: 'Org A' }, { name: 'Org B' }])
      .returning();

    const names = ['writerA', 'readOnlyA', 'outsider'];
    const users = await db
      .insert(schema.users)
      .values(
        names.map((name) => ({
          fullName: name,
          email: `${name}@example.com`,
          password: 'hash',
        })),
      )
      .returning();

    await db.insert(schema.organizationUsers).values([
      {
        orgId: orgA.id,
        userId: users[0].id,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgA.id,
        userId: users[1].id,
        role: 'member',
        permission: 'read_only',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgB.id,
        userId: users[2].id,
        role: 'admin',
        permission: 'full',
        inviteStatus: 'accepted',
      },
    ]);

    const [address] = await db
      .insert(schema.addresses)
      .values({
        zipCode: '01310-100',
        street: 'Av. Paulista',
        number: '100',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      })
      .returning();
    const [venue] = await db
      .insert(schema.venues)
      .values({ name: 'Espaço', maxCapacity: 1000, addressId: address.id })
      .returning();

    const baseEvent = {
      venueId: venue.id,
      startDate: new Date('2026-12-01T20:00:00Z'),
      endDate: new Date('2026-12-02T03:00:00Z'),
    };
    const [evA, emptyA, evB] = await db
      .insert(schema.events)
      .values([
        {
          ...baseEvent,
          name: 'Codeniver',
          organizerId: orgA.id,
          expectedAudience: 300,
        },
        { ...baseEvent, name: 'Sem dados', organizerId: orgA.id },
        { ...baseEvent, name: 'Evento B', organizerId: orgB.id },
      ])
      .returning();
    eventOfA = evA.id;
    emptyEventOfA = emptyA.id;
    eventOfB = evB.id;

    await db.insert(schema.ticketTypes).values(
      [
        ['Promocional', 45, 10],
        ['Pré-venda 1', 48.33, 30],
        ['Pré-venda 2', 50, 40],
        ['1º Lote', 50, 85],
        ['2º Lote', 55, 105],
        ['3º Lote', 60, 30],
      ].map(([batch, price, quantity], index) => ({
        eventId: eventOfA,
        batch: batch as string,
        price: price as number,
        quantity: quantity as number,
        salesStartDate: day(index + 1),
      })),
    );

    const expense = (
      group: schema.ExpenseGroup,
      category: string,
      amount: number,
      extra: Partial<typeof schema.expenses.$inferInsert> = {},
    ) => ({
      eventId: eventOfA,
      description: `${category} ${amount}`,
      group,
      category,
      unitPrice: amount,
      amount,
      ...extra,
    });
    await db.insert(schema.expenses).values([
      expense('fixed', 'Estrutura', 5000, {
        quoted: true,
        paymentStatus: 'pago',
      }),
      expense('fixed', 'Estrutura', 3040, { quoted: true }),
      expense('fixed', 'Staff', 1970),
      expense('variable', 'Open', 4803.47, { quoted: true }),
      expense('marketing', 'MKT', 690.47),
      expense('fixed', 'Estrutura', 9999, { paymentStatus: 'cancelado' }),
    ]);

    const jwt = module.get(JwtService);
    for (const user of users) {
      tokens[user.fullName] = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    }
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  it('exige autenticação (401), permissão write (403) e oculta evento de outra organização (404)', async () => {
    await http().get(summaryOf(eventOfA)).expect(401);
    await http().get(summaryOf(eventOfA)).set(as('readOnlyA')).expect(403);
    await http().get(summaryOf(eventOfB)).set(as('writerA')).expect(404);
  });

  it('rejeita audience inválido com 400', async () => {
    for (const audience of ['0', '-1', '1.5', 'abc']) {
      await http()
        .get(summaryOf(eventOfA, `?audience=${audience}`))
        .set(as('writerA'))
        .expect(400);
    }
  });

  it('sem audience usa o público esperado e bate com os números da planilha', async () => {
    const { body } = await http()
      .get(summaryOf(eventOfA))
      .set(as('writerA'))
      .expect(200);

    expect(body.expectedAudience).toBe(300);
    expect(body.expenses).toEqual({
      total: 15503.94,
      byGroup: { fixed: 10010, variable: 4803.47, marketing: 690.47 },
      paidTotal: 5000,
      pendingTotal: 10503.94,
      itemCount: 5,
      quotedCount: 3,
    });
    expect(body.byCategory.slice(0, 2)).toEqual([
      { category: 'Estrutura', group: 'fixed', total: 8040 },
      { category: 'Open', group: 'variable', total: 4803.47 },
    ]);
    expect(body.pending).toEqual({ toPay: 4, notQuoted: 2 });
    expect(body.tickets.planned).toBe(300);
    expect(body.tickets.lots[0]).toMatchObject({
      batch: 'Promocional',
      price: 45,
      start: 1,
      end: 10,
    });
    expect(body.result).toEqual({
      audience: 300,
      revenue: 15724.9,
      averageTicket: 52.42,
      breakEven: 295.78,
      costPerPerson: 51.68,
      profit: 220.96,
      breakEvenBatch: '3º Lote',
    });
    expect(body.scenarios.map((s: { audience: number }) => s.audience)).toEqual(
      [260, 280, 300, 320, 340],
    );
  });

  it('com audience=320 o lucro é 1.420,96', async () => {
    const { body } = await http()
      .get(summaryOf(eventOfA, '?audience=320'))
      .set(as('writerA'))
      .expect(200);

    expect(body.result).toMatchObject({ audience: 320, profit: 1420.96 });
    expect(body.tickets.lots.at(-1)).toMatchObject({
      batch: '3º Lote',
      start: 271,
      end: 320,
    });
  });

  it('evento sem lotes, despesas nem público responde com zeros e campos null', async () => {
    const { body } = await http()
      .get(summaryOf(emptyEventOfA))
      .set(as('writerA'))
      .expect(200);

    expect(body).toEqual({
      expectedAudience: null,
      expenses: {
        total: 0,
        byGroup: { fixed: 0, variable: 0, marketing: 0 },
        paidTotal: 0,
        pendingTotal: 0,
        itemCount: 0,
        quotedCount: 0,
      },
      byCategory: [],
      pending: { toPay: 0, notQuoted: 0 },
      tickets: { planned: 0, lots: [] },
      result: {
        audience: null,
        revenue: null,
        averageTicket: null,
        breakEven: null,
        costPerPerson: null,
        profit: null,
        breakEvenBatch: null,
      },
      scenarios: [],
    });
  });
});
