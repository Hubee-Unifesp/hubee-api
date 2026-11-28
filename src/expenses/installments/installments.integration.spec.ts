import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import request from 'supertest';
import { DRIZZLE } from '../../database/database.constants';
import * as schema from '../../database/schema';
import { EventRepository } from '../../event/event.repository';
import { EventService } from '../../event/event.service';
import { NotificationsRepository } from '../../notifications/notifications.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { OrganizationService } from '../../organization/organization.service';
import { StorageService } from '../../storage/storage.service';
import { SuppliersService } from '../../suppliers/suppliers.service';
import { VenueService } from '../../venue/venue.service';
import { ExpensesController } from '../expenses.controller';
import { ExpensesRepository } from '../expenses.repository';
import { ExpensesService } from '../expenses.service';
import { InstallmentsController } from './installments.controller';
import { InstallmentsRepository } from './installments.repository';
import { InstallmentsService } from './installments.service';

describe('Cronograma de pagamentos das despesas (GOL-300, banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};
  let orgA: string;
  let orgB: string;
  let eventOfA: string;
  let eventOfB: string;
  let supplierId: string;
  let expenseId: string;
  let otherEventExpenseId: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [ExpensesController, InstallmentsController],
      providers: [
        ExpensesService,
        ExpensesRepository,
        InstallmentsRepository,
        InstallmentsService,
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

    const [expense, otherExpense] = await db
      .insert(schema.expenses)
      .values([
        {
          eventId: eventOfA,
          supplierId,
          description: 'Som e iluminação',
          group: 'fixed' as const,
          category: 'Estrutura',
          quantity: 1,
          unitPrice: 1000,
          amount: 1000,
        },
        {
          eventId: eventOfB,
          description: 'Buffet',
          group: 'variable' as const,
          category: 'Alimentação',
          quantity: 1,
          unitPrice: 500,
          amount: 500,
        },
      ])
      .returning();
    expenseId = expense.id;
    otherEventExpenseId = otherExpense.id;

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

  const installmentsOf = (eventId: string, id: string) =>
    `/events/${eventId}/expenses/${id}/installments`;

  describe('RBAC', () => {
    it('exige autenticação, permissão write e oculta evento de outra organização', async () => {
      await http().get(installmentsOf(eventOfA, expenseId)).expect(401);
      await http()
        .get(installmentsOf(eventOfA, expenseId))
        .set(as('readOnlyA'))
        .expect(403);
      await http()
        .get(`/events/${eventOfB}/installments`)
        .set(as('writerA'))
        .expect(404);
    });

    it('responde 404 para despesa de outro evento na rota do evento', async () => {
      await http()
        .get(installmentsOf(eventOfA, otherEventExpenseId))
        .set(as('admin'))
        .expect(404);
    });
  });

  describe('CRUD e limite pelo valor da despesa', () => {
    let downPaymentId: string;
    let remainderId: string;

    it('cadastra sinal de 40% e restante de 60%', async () => {
      const downPayment = await http()
        .post(installmentsOf(eventOfA, expenseId))
        .set(as('writerA'))
        .send({ dueDate: '2026-11-10T12:00:00Z', amount: 400 })
        .expect(201);
      downPaymentId = downPayment.body.id;
      expect(downPayment.body).toMatchObject({
        expenseId,
        expenseDescription: 'Som e iluminação',
        expenseCategory: 'Estrutura',
        expenseGroup: 'fixed',
        supplierName: 'Som & Luz Eventos Ltda',
        amount: 400,
        status: 'pendente',
        paidBy: null,
        paymentMethod: null,
      });

      const remainder = await http()
        .post(installmentsOf(eventOfA, expenseId))
        .set(as('writerA'))
        .send({
          dueDate: '2026-11-30T12:00:00Z',
          amount: 600,
          status: 'pago',
          paidBy: 'Ana',
          paymentMethod: 'Pix',
        })
        .expect(201);
      remainderId = remainder.body.id;
    });

    it('recusa parcela que faz a soma passar do valor da despesa', async () => {
      const response = await http()
        .post(installmentsOf(eventOfA, expenseId))
        .set(as('writerA'))
        .send({ dueDate: '2026-11-20T12:00:00Z', amount: 0.01 })
        .expect(400);
      expect(response.body.message).toContain('Valor disponível: R$ 0,00');
    });

    it('recusa aumentar uma parcela além do disponível e aceita depois de cancelar outra', async () => {
      await http()
        .patch(`${installmentsOf(eventOfA, expenseId)}/${downPaymentId}`)
        .set(as('writerA'))
        .send({ amount: 401 })
        .expect(400);

      await http()
        .patch(`${installmentsOf(eventOfA, expenseId)}/${remainderId}`)
        .set(as('writerA'))
        .send({ status: 'cancelado' })
        .expect(200);

      await http()
        .patch(`${installmentsOf(eventOfA, expenseId)}/${downPaymentId}`)
        .set(as('writerA'))
        .send({ amount: 1000 })
        .expect(200);

      await http()
        .patch(`${installmentsOf(eventOfA, expenseId)}/${remainderId}`)
        .set(as('writerA'))
        .send({ status: 'pendente' })
        .expect(400);
    });

    it('rejeita valor zero, data inválida e campos fora do contrato', async () => {
      for (const body of [
        { dueDate: '2026-11-10T12:00:00Z', amount: 0 },
        { dueDate: 'amanhã', amount: 10 },
        { dueDate: '2026-11-10T12:00:00Z', amount: 10, expenseId },
      ]) {
        await http()
          .post(installmentsOf(eventOfA, expenseId))
          .set(as('writerA'))
          .send(body)
          .expect(400);
      }
    });

    it('não deixa o valor da despesa ficar menor que a soma das parcelas', async () => {
      await http()
        .patch(`/events/${eventOfA}/expenses/${expenseId}`)
        .set(as('writerA'))
        .send({ unitPrice: 999.99 })
        .expect(400);
    });

    it('lista o cronograma do evento por data e remove parcelas', async () => {
      const schedule = await http()
        .get(`/events/${eventOfA}/installments`)
        .set(as('writerA'))
        .expect(200);
      expect(schedule.body.map((row: { id: string }) => row.id)).toEqual([
        downPaymentId,
        remainderId,
      ]);

      await http()
        .delete(`${installmentsOf(eventOfA, expenseId)}/${downPaymentId}`)
        .set(as('writerA'))
        .expect(204);
      await http()
        .get(`${installmentsOf(eventOfA, expenseId)}/${downPaymentId}`)
        .set(as('writerA'))
        .expect(404);
    });

    it('apaga as parcelas junto com a despesa', async () => {
      await http()
        .delete(`/events/${eventOfA}/expenses/${expenseId}`)
        .set(as('writerA'))
        .expect(204);
      const schedule = await http()
        .get(`/events/${eventOfA}/installments`)
        .set(as('writerA'))
        .expect(200);
      expect(schedule.body).toEqual([]);
    });
  });
});
