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
import { SuppliersService } from '../suppliers/suppliers.service';
import { VenueService } from '../venue/venue.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';

describe('Despesas em formato de orçamento (GOL-296, banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};
  let orgA: string;
  let orgB: string;
  let eventOfA: string;
  let eventOfB: string;
  let supplierId: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [ExpensesController],
      providers: [
        ExpensesService,
        ExpensesRepository,
        EventService,
        EventRepository,
        SuppliersService,
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

    const [orgRowA, orgRowB] = await db
      .insert(schema.organizations)
      .values([{ name: 'Org A' }, { name: 'Org B' }])
      .returning();
    orgA = orgRowA.id;
    orgB = orgRowB.id;

    const names = ['writerA', 'readOnlyA', 'outsider', 'admin'];
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

    const idOf = Object.fromEntries(
      names.map((name, index) => [name, users[index].id]),
    );

    await db.insert(schema.organizationUsers).values([
      {
        orgId: orgA,
        userId: idOf.writerA,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgA,
        userId: idOf.readOnlyA,
        role: 'member',
        permission: 'read_only',
        inviteStatus: 'accepted',
      },
      {
        orgId: orgB,
        userId: idOf.outsider,
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
      .values({
        name: 'Espaço Teste',
        maxCapacity: 1000,
        addressId: address.id,
      })
      .returning();

    const [evA, evB] = await db
      .insert(schema.events)
      .values([
        {
          name: 'Codeniver',
          organizerId: orgA,
          venueId: venue.id,
          startDate: new Date('2026-12-01T20:00:00Z'),
          endDate: new Date('2026-12-02T03:00:00Z'),
        },
        {
          name: 'Evento B',
          organizerId: orgB,
          venueId: venue.id,
          startDate: new Date('2026-12-10T20:00:00Z'),
          endDate: new Date('2026-12-11T03:00:00Z'),
        },
      ])
      .returning();
    eventOfA = evA.id;
    eventOfB = evB.id;

    const [sup] = await db
      .insert(schema.suppliers)
      .values({
        companyName: 'Som & Luz Eventos Ltda',
        cnpjCpf: '12345678000190',
      })
      .returning();
    supplierId = sup.id;

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

  describe('RBAC e validações', () => {
    it('exige autenticação (401), permissão write (403) e oculta evento de outra organização (404)', async () => {
      await http().get(`/events/${eventOfA}/expenses`).expect(401);
      await http()
        .get(`/events/${eventOfA}/expenses`)
        .set(as('readOnlyA'))
        .expect(403);
      await http()
        .get(`/events/${eventOfB}/expenses`)
        .set(as('writerA'))
        .expect(404);
    });

    it('rejeita envio de amount ou costType no payload com 400', async () => {
      await http()
        .post(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .send({
          description: 'Item proibido',
          group: 'fixed',
          category: 'Estrutura',
          unitPrice: 100,
          amount: 100,
        })
        .expect(400);

      await http()
        .post(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .send({
          description: 'Item legado',
          group: 'fixed',
          category: 'Estrutura',
          costType: 'Estrutura',
          unitPrice: 100,
        })
        .expect(400);
    });

    it('rejeita null em campos não anuláveis, dueDate numérico e estouro de numeric(12,2) com 400', async () => {
      for (const override of [
        { quoted: null },
        { paymentStatus: null },
        { quantity: null },
        { dueDate: 0 },
        { notes: 'a'.repeat(1001) },
        { quantity: 100_000, unitPrice: 200_000 },
      ]) {
        await http()
          .post(`/events/${eventOfA}/expenses`)
          .set(as('writerA'))
          .send({
            description: 'Item inválido',
            group: 'fixed',
            category: 'Estrutura',
            unitPrice: 100,
            ...override,
          })
          .expect(400);
      }
    });
  });

  describe('CRUD no formato de orçamento', () => {
    it('cria despesa sem fornecedor e sem data aplicando padrões e calculando amount', async () => {
      const res = await http()
        .post(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .send({
          description: 'Arte e divulgação digital',
          group: 'marketing',
          category: 'MKT',
          unitPrice: 350.5,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        eventId: eventOfA,
        supplierId: null,
        supplierName: null,
        description: 'Arte e divulgação digital',
        group: 'marketing',
        category: 'MKT',
        quantity: 1,
        unitPrice: 350.5,
        amount: 350.5,
        responsible: null,
        quoted: false,
        notes: null,
        dueDate: null,
        paymentStatus: 'pendente',
      });
    });

    it('cria despesa com fornecedor retornando supplierName e amount = quantity * unitPrice com 2 casas', async () => {
      const res = await http()
        .post(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .send({
          supplierId,
          description: 'Gelo e copos',
          group: 'variable',
          category: 'Open',
          quantity: 3,
          unitPrice: 19.99,
          responsible: 'Carlos',
          quoted: false,
          notes: 'Cotar entrega no dia',
          dueDate: '2026-11-28T12:00:00.000Z',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        supplierId,
        supplierName: 'Som & Luz Eventos Ltda',
        quantity: 3,
        unitPrice: 19.99,
        amount: 59.97,
        responsible: 'Carlos',
        quoted: false,
        notes: 'Cotar entrega no dia',
      });
    });

    it('PATCH só com { quoted: true } e { paymentStatus: "pago" } não altera os outros campos', async () => {
      const created = await http()
        .post(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .send({
          supplierId,
          description: 'Segurança',
          group: 'fixed',
          category: 'Staff',
          quantity: 4,
          unitPrice: 220,
          responsible: 'Maria',
          notes: 'Turno noturno',
        })
        .expect(201);

      const patchQuoted = await http()
        .patch(`/events/${eventOfA}/expenses/${created.body.id}`)
        .set(as('writerA'))
        .send({ quoted: true })
        .expect(200);

      expect(patchQuoted.body).toMatchObject({
        id: created.body.id,
        supplierId,
        supplierName: 'Som & Luz Eventos Ltda',
        description: 'Segurança',
        group: 'fixed',
        category: 'Staff',
        quantity: 4,
        unitPrice: 220,
        amount: 880,
        responsible: 'Maria',
        notes: 'Turno noturno',
        quoted: true,
        paymentStatus: 'pendente',
      });

      const patchPaid = await http()
        .patch(`/events/${eventOfA}/expenses/${created.body.id}`)
        .set(as('writerA'))
        .send({ paymentStatus: 'pago' })
        .expect(200);

      expect(patchPaid.body).toMatchObject({
        quoted: true,
        paymentStatus: 'pago',
        amount: 880,
      });
    });

    it('PATCH recalcula amount ao alterar quantity/unitPrice e limpa opcionais com null', async () => {
      const created = await http()
        .post(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .send({
          supplierId,
          description: 'Gerador',
          group: 'fixed',
          category: 'Estrutura',
          quantity: 1,
          unitPrice: 1200,
          dueDate: '2026-11-29T12:00:00.000Z',
        })
        .expect(201);

      const updated = await http()
        .patch(`/events/${eventOfA}/expenses/${created.body.id}`)
        .set(as('writerA'))
        .send({
          quantity: 2,
          supplierId: null,
          dueDate: null,
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        quantity: 2,
        unitPrice: 1200,
        amount: 2400,
        supplierId: null,
        supplierName: null,
        dueDate: null,
      });
    });

    it('filtra por group, category, quoted e paymentStatus e ordena por group e category', async () => {
      const all = await http()
        .get(`/events/${eventOfA}/expenses`)
        .set(as('writerA'))
        .expect(200);

      expect(
        all.body.map((item: { group: string; category: string }) => [
          item.group,
          item.category,
        ]),
      ).toEqual([
        ['fixed', 'Estrutura'],
        ['fixed', 'Staff'],
        ['variable', 'Open'],
        ['marketing', 'MKT'],
      ]);

      const filtered = await http()
        .get(
          `/events/${eventOfA}/expenses?group=fixed&category=Staff&quoted=true&paymentStatus=pago`,
        )
        .set(as('writerA'))
        .expect(200);

      expect(filtered.body).toHaveLength(1);
      expect(filtered.body[0]).toMatchObject({
        description: 'Segurança',
        group: 'fixed',
        category: 'Staff',
        quoted: true,
        paymentStatus: 'pago',
      });
    });
  });
});
