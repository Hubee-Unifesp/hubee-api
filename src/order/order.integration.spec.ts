import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
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
import { EventService } from '../event/event.service';
import { CheckoutController } from '../payment/checkout.controller';
import { PaymentRepository } from '../payment/payment.repository';
import { PaymentService } from '../payment/payment.service';
import { TicketController } from '../ticket/ticket.controller';
import { TicketRepository } from '../ticket/ticket.repository';
import { TicketService } from '../ticket/ticket.service';
import { TicketTypeRepository } from '../ticket-type/ticket-type.repository';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsersService } from '../users/users.service';
import { OrderController } from './order.controller';
import { OrderItemRepository } from './order-item.repository';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

/**
 * Compra de ponta a ponta (GOL-175), com services, repositories e SQL reais
 * sobre Postgres em memória: saldo dos lotes, atomicidade do checkout e quem
 * enxerga cada ingresso. Usuários e eventos são falsos só onde não importam.
 */
describe('Pedidos, checkout e ingressos (banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let ticketRepository: TicketRepository;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let eventId: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  async function newLot(quantity: number, price = 50) {
    const [lot] = await db
      .insert(schema.ticketTypes)
      .values({ eventId, batch: `Lote ${Math.random()}`, price, quantity })
      .returning();
    return lot.id;
  }

  const order = (name: string, items: object[]) =>
    http().post('/orders').set(as(name)).send({ items });

  const pay = (name: string, orderId: string, paymentMethod = 'pix') =>
    http().post('/payments').set(as(name)).send({ orderId, paymentMethod });

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [OrderController, CheckoutController, TicketController],
      providers: [
        OrderService,
        OrderRepository,
        OrderItemRepository,
        PaymentService,
        PaymentRepository,
        TicketService,
        TicketRepository,
        TicketTypeService,
        TicketTypeRepository,
        { provide: DRIZZLE, useValue: db },
        {
          provide: UsersService,
          useValue: {
            findOne: async () => ({
              cpf: '52998224725',
              birthDate: '1990-01-01',
            }),
          },
        },
        { provide: EventService, useValue: { findOne: async () => ({}) } },
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
    ticketRepository = module.get(TicketRepository);

    const [organization] = await db
      .insert(schema.organizations)
      .values({ name: 'Atlética' })
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
      .values({ addressId: address.id, name: 'Ginásio', maxCapacity: 500 })
      .returning();
    [{ id: eventId }] = await db
      .insert(schema.events)
      .values({
        name: 'Calourada',
        organizerId: organization.id,
        venueId: venue.id,
        startDate: new Date('2999-12-10T20:00:00Z'),
        endDate: new Date('2999-12-11T02:00:00Z'),
        status: 'published',
      })
      .returning();

    const names = ['ana', 'bruno', 'admin'];
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
    const jwt = module.get(JwtService);
    for (const user of users) {
      ids[user.fullName] = user.id;
      tokens[user.fullName] = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  describe('POST /orders', () => {
    it('cria o pedido pendente com itens e total calculado no servidor', async () => {
      const lot = await newLot(10, 49.9);

      const response = await order('ana', [
        { ticketTypeId: lot, quantity: 3 },
      ]).expect(201);

      expect(response.body).toMatchObject({
        userId: ids.ana,
        status: 'pendente',
        totalAmount: 149.7,
      });
      expect(response.body.items).toEqual([
        expect.objectContaining({
          ticketTypeId: lot,
          quantity: 3,
          unitPrice: 49.9,
        }),
      ]);
    });

    it('recusa pedido sem token', async () => {
      await http().post('/orders').send({ items: [] }).expect(401);
    });

    it('recusa total enviado pelo cliente', async () => {
      const lot = await newLot(10);

      await http()
        .post('/orders')
        .set(as('ana'))
        .send({ totalAmount: 1, items: [{ ticketTypeId: lot, quantity: 1 }] })
        .expect(400);
    });

    it('recusa quantidade acima do saldo e não grava pedido nenhum', async () => {
      const lot = await newLot(2);
      const before = await db.select().from(schema.orders);

      const response = await order('ana', [
        { ticketTypeId: lot, quantity: 3 },
      ]).expect(422);

      expect(response.body.message).toContain('tem apenas 2 ingresso(s)');
      expect(await db.select().from(schema.orders)).toHaveLength(before.length);
    });

    it('recusa lote esgotado', async () => {
      const lot = await newLot(1);
      await order('ana', [{ ticketTypeId: lot, quantity: 1 }]).expect(201);

      const response = await order('bruno', [
        { ticketTypeId: lot, quantity: 1 },
      ]).expect(422);

      expect(response.body.message).toContain('esgotado');
    });

    it('pedido pendente reserva o saldo para os outros compradores', async () => {
      const lot = await newLot(5);
      await order('ana', [{ ticketTypeId: lot, quantity: 4 }]).expect(201);

      await order('bruno', [{ ticketTypeId: lot, quantity: 2 }]).expect(422);
      await order('bruno', [{ ticketTypeId: lot, quantity: 1 }]).expect(201);
    });

    it('cancelar o pedido devolve o saldo ao lote', async () => {
      const lot = await newLot(2);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 2 },
      ]).expect(201);
      await order('bruno', [{ ticketTypeId: lot, quantity: 1 }]).expect(422);

      await http()
        .delete(`/orders/${created.body.id}`)
        .set(as('ana'))
        .expect(204);

      await order('bruno', [{ ticketTypeId: lot, quantity: 2 }]).expect(201);
    });

    it('duas compras simultâneas do último ingresso: só uma passa', async () => {
      const lot = await newLot(1);

      const results = await Promise.all([
        order('ana', [{ ticketTypeId: lot, quantity: 1 }]),
        order('bruno', [{ ticketTypeId: lot, quantity: 1 }]),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual([201, 422]);
      const items = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.ticketTypeId, lot));
      expect(items).toHaveLength(1);
    });

    it('um item sem saldo derruba o pedido inteiro', async () => {
      const lot = await newLot(5);
      const soldOut = await newLot(0);

      await order('ana', [
        { ticketTypeId: lot, quantity: 1 },
        { ticketTypeId: soldOut, quantity: 1 },
      ]).expect(422);

      const items = await db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.ticketTypeId, lot));
      expect(items).toHaveLength(0);
    });

    it('lote inexistente responde 404', async () => {
      await order('ana', [
        { ticketTypeId: '11111111-1111-4111-8111-111111111111', quantity: 1 },
      ]).expect(404);
    });
  });

  describe('POST /payments e GET /tickets', () => {
    it('não emite ingressos enquanto o pedido está pendente', async () => {
      const lot = await newLot(5);
      await order('ana', [{ ticketTypeId: lot, quantity: 2 }]).expect(201);

      const mine = await http().get('/tickets').set(as('ana')).expect(200);

      expect(
        mine.body.filter(
          (ticket: { ticketTypeId: string }) => ticket.ticketTypeId === lot,
        ),
      ).toEqual([]);
    });

    it('paga o pedido e emite um ingresso por unidade com QR code único', async () => {
      const lot = await newLot(5, 80);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 3 },
      ]).expect(201);

      const payment = await pay('ana', created.body.id).expect(201);

      expect(payment.body).toMatchObject({
        orderId: created.body.id,
        status: 'confirmado',
        paymentMethod: 'pix',
        amount: 240,
      });
      expect(payment.body.paidAt).toBeTruthy();

      const [paid] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, created.body.id));
      expect(paid.status).toBe('pago');

      const mine = await http().get('/tickets').set(as('ana')).expect(200);
      const tickets = mine.body.filter(
        (ticket: { orderId: string }) => ticket.orderId === created.body.id,
      );
      expect(tickets).toHaveLength(3);
      expect(
        new Set(tickets.map((t: { qrCode: string }) => t.qrCode)).size,
      ).toBe(3);
      for (const ticket of tickets) {
        expect(ticket).toMatchObject({
          holderUserId: ids.ana,
          status: 'emitido',
          eventId,
          event: {
            id: eventId,
            name: 'Calourada',
            venue: { name: 'Ginásio', address: { city: 'São Paulo' } },
          },
          ticketType: { id: lot, price: 80 },
        });
        expect(ticket.qrCode).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('o comprador não recebe o valor do pagamento do cliente: o total é o do pedido', async () => {
      const lot = await newLot(5, 10);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 2 },
      ]).expect(201);

      await http()
        .post('/payments')
        .set(as('ana'))
        .send({ orderId: created.body.id, paymentMethod: 'pix', amount: 1 })
        .expect(400);
    });

    it('cada usuário só vê os próprios ingressos, inclusive o ADMIN', async () => {
      const lot = await newLot(5);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 1 },
      ]).expect(201);
      await pay('ana', created.body.id).expect(201);

      for (const name of ['bruno', 'admin']) {
        const response = await http().get('/tickets').set(as(name)).expect(200);
        expect(
          response.body.filter(
            (ticket: { orderId: string }) => ticket.orderId === created.body.id,
          ),
        ).toEqual([]);
      }
      await http().get('/tickets').expect(401);
    });

    it('não paga pedido de outra pessoa (404) e não emite nada', async () => {
      const lot = await newLot(5);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 1 },
      ]).expect(201);

      await pay('bruno', created.body.id).expect(404);

      const [row] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, created.body.id));
      expect(row.status).toBe('pendente');
      expect(
        await db
          .select()
          .from(schema.tickets)
          .where(eq(schema.tickets.orderId, created.body.id)),
      ).toHaveLength(0);
    });

    it('segundo checkout do mesmo pedido responde 422 e não duplica ingressos', async () => {
      const lot = await newLot(5);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 2 },
      ]).expect(201);
      await pay('ana', created.body.id).expect(201);

      await pay('ana', created.body.id).expect(422);

      expect(
        await db
          .select()
          .from(schema.tickets)
          .where(eq(schema.tickets.orderId, created.body.id)),
      ).toHaveLength(2);
    });

    it('checkouts simultâneos do mesmo pedido: só um paga', async () => {
      const lot = await newLot(5);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 2 },
      ]).expect(201);

      const results = await Promise.all([
        pay('ana', created.body.id),
        pay('ana', created.body.id),
      ]);

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(
        await db
          .select()
          .from(schema.tickets)
          .where(eq(schema.tickets.orderId, created.body.id)),
      ).toHaveLength(2);
    });

    it('não paga pedido cancelado', async () => {
      const lot = await newLot(5);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 1 },
      ]).expect(201);
      await http()
        .delete(`/orders/${created.body.id}`)
        .set(as('ana'))
        .expect(204);

      await pay('ana', created.body.id).expect(422);
    });

    it('se a emissão falhar, o pagamento é desfeito e o pedido segue pendente', async () => {
      const lot = await newLot(5);
      const created = await order('ana', [
        { ticketTypeId: lot, quantity: 1 },
      ]).expect(201);
      jest
        .spyOn(ticketRepository, 'createMany')
        .mockRejectedValueOnce(new Error('falha na emissão'));

      await pay('ana', created.body.id).expect(500);

      const [row] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, created.body.id));
      expect(row.status).toBe('pendente');
      expect(
        await db
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.orderId, created.body.id)),
      ).toHaveLength(0);

      await pay('ana', created.body.id).expect(201);
    });
  });
});
