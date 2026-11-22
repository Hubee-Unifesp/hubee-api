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
import { EventAiDraftService } from '../event/ai-draft/event-ai-draft.service';
import { EventController } from '../event/event.controller';
import { EventRepository } from '../event/event.repository';
import { EventService } from '../event/event.service';
import { OrderController } from '../order/order.controller';
import { OrderItemRepository } from '../order/order-item.repository';
import { OrderRepository } from '../order/order.repository';
import { OrderService } from '../order/order.service';
import { OrganizationService } from '../organization/organization.service';
import { CheckoutController } from '../payment/checkout.controller';
import { PaymentController } from '../payment/payment.controller';
import { PaymentRepository } from '../payment/payment.repository';
import { PaymentService } from '../payment/payment.service';
import { StorageService } from '../storage/storage.service';
import { TicketRepository } from '../ticket/ticket.repository';
import { TicketService } from '../ticket/ticket.service';
import { TicketTypeRepository } from '../ticket-type/ticket-type.repository';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsersService } from '../users/users.service';
import { VenueService } from '../venue/venue.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('Notificações in-app e gatilhos (GOL-268, PGlite)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};
  let eventId: string;
  let ticketTypeId: string;

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [
        NotificationsController,
        OrderController,
        CheckoutController,
        PaymentController,
        EventController,
      ],
      providers: [
        { provide: DRIZZLE, useValue: db },
        NotificationsRepository,
        NotificationsService,
        OrderRepository,
        OrderItemRepository,
        OrderService,
        PaymentRepository,
        PaymentService,
        TicketRepository,
        TicketService,
        TicketTypeRepository,
        TicketTypeService,
        UsersService,
        EventRepository,
        EventService,
        {
          provide: EventAiDraftService,
          useValue: { generateDraft: async () => ({}) },
        },
        {
          provide: OrganizationService,
          useValue: { findOne: async () => ({}) },
        },
        {
          provide: VenueService,
          useValue: { findOne: async () => ({}) },
        },
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

    const users = await db
      .insert(schema.users)
      .values([
        {
          fullName: 'buyer',
          email: 'buyer@hubee.com',
          password: 'hash',
          cpf: '11122233344',
          birthDate: '1999-05-10',
          role: 'USER',
        },
        {
          fullName: 'organizer',
          email: 'organizer@hubee.com',
          password: 'hash',
          cpf: '22233344455',
          birthDate: '1995-03-15',
          role: 'USER',
        },
        {
          fullName: 'pendingMember',
          email: 'pending@hubee.com',
          password: 'hash',
          role: 'USER',
        },
        {
          fullName: 'admin',
          email: 'admin@hubee.com',
          password: 'hash',
          role: 'ADMIN',
        },
      ])
      .returning();

    const jwt = module.get(JwtService);
    for (const user of users) {
      userIds[user.fullName] = user.id;
      tokens[user.fullName] = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    }

    const [org] = await db
      .insert(schema.organizations)
      .values({ name: 'Atlética Hubee', representativeId: userIds.organizer })
      .returning();

    await db.insert(schema.organizationUsers).values([
      {
        orgId: org.id,
        userId: userIds.organizer,
        role: 'admin',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: org.id,
        userId: userIds.pendingMember,
        role: 'member',
        permission: 'full',
        inviteStatus: 'pending',
      },
    ]);

    const [address] = await db
      .insert(schema.addresses)
      .values({
        zipCode: '12247-014',
        street: 'Av. Cesare Mansueto Giulio Lattes',
        number: '1201',
        neighborhood: 'Eugênio de Melo',
        city: 'São José dos Campos',
        state: 'SP',
        country: 'Brasil',
      })
      .returning();

    const [venue] = await db
      .insert(schema.venues)
      .values({
        name: 'Auditório Principal',
        maxCapacity: 500,
        addressId: address.id,
      })
      .returning();

    const [event] = await db
      .insert(schema.events)
      .values({
        name: 'Intercomp 2027',
        organizerId: org.id,
        venueId: venue.id,
        startDate: new Date('2999-10-10T18:00:00Z'),
        endDate: new Date('2999-10-11T04:00:00Z'),
        status: 'published',
      })
      .returning();
    eventId = event.id;

    // Lote com apenas 2 ingressos para testar esgotamento no checkout
    const [ticketType] = await db
      .insert(schema.ticketTypes)
      .values({
        eventId: event.id,
        batch: 'Lote Promocional',
        price: 50,
        quantity: 2,
        modality: 'inteira',
      })
      .returning();
    ticketTypeId = ticketType.id;
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  it('retorna 401 sem token em todas as rotas de /notifications', async () => {
    await http().get('/notifications').expect(401);
    await http().patch('/notifications/read-all').expect(401);
    await http()
      .patch('/notifications/11111111-1111-4111-8111-111111111111/read')
      .expect(401);
  });

  it('checkout gera payment_confirmed para o comprador e new_sale + batch_sold_out para o organizador', async () => {
    const orderRes = await http()
      .post('/orders')
      .set(as('buyer'))
      .send({ items: [{ ticketTypeId, quantity: 2 }] })
      .expect(201);

    await http()
      .post('/payments')
      .set(as('buyer'))
      .send({ orderId: orderRes.body.id, paymentMethod: 'pix' })
      .expect(201);

    // Comprador recebe payment_confirmed
    const buyerNotifs = await http()
      .get('/notifications')
      .set(as('buyer'))
      .expect(200);

    expect(buyerNotifs.body.unreadCount).toBe(1);
    expect(buyerNotifs.body.data).toHaveLength(1);
    expect(buyerNotifs.body.data[0]).toMatchObject({
      userId: userIds.buyer,
      type: 'payment_confirmed',
      title: 'Pagamento confirmado',
      href: '/conta/ingressos',
      readAt: null,
    });

    // Organizador aceito recebe new_sale e batch_sold_out
    const orgNotifs = await http()
      .get('/notifications')
      .set(as('organizer'))
      .expect(200);

    expect(orgNotifs.body.unreadCount).toBe(2);
    expect(orgNotifs.body.data.map((n: { type: string }) => n.type)).toEqual(
      expect.arrayContaining(['new_sale', 'batch_sold_out']),
    );

    // Membro com convite pendente não recebe notificações da organização
    const pendingNotifs = await http()
      .get('/notifications')
      .set(as('pendingMember'))
      .expect(200);

    expect(pendingNotifs.body.unreadCount).toBe(0);
    expect(pendingNotifs.body.data).toHaveLength(0);
  });

  it('usuário não consegue marcar notificação de terceiros como lida (404)', async () => {
    const buyerNotifs = await http()
      .get('/notifications')
      .set(as('buyer'))
      .expect(200);
    const buyerNotifId = buyerNotifs.body.data[0].id as string;

    await http()
      .patch(`/notifications/${buyerNotifId}/read`)
      .set(as('organizer'))
      .expect(404);
  });

  it('marca uma notificação como lida, filtra por unreadOnly e marca todas como lidas', async () => {
    const orgNotifs = await http()
      .get('/notifications')
      .set(as('organizer'))
      .expect(200);

    const firstId = orgNotifs.body.data[0].id as string;

    const readRes = await http()
      .patch(`/notifications/${firstId}/read`)
      .set(as('organizer'))
      .expect(200);

    expect(readRes.body.id).toBe(firstId);
    expect(readRes.body.readAt).not.toBeNull();

    const unreadOnlyRes = await http()
      .get('/notifications?unreadOnly=true')
      .set(as('organizer'))
      .expect(200);

    expect(unreadOnlyRes.body.unreadCount).toBe(1);
    expect(unreadOnlyRes.body.data).toHaveLength(1);
    expect(unreadOnlyRes.body.data[0].id).not.toBe(firstId);

    const readAllRes = await http()
      .patch('/notifications/read-all')
      .set(as('organizer'))
      .expect(200);

    expect(readAllRes.body).toEqual({ updatedCount: 1 });

    const afterReadAll = await http()
      .get('/notifications?unreadOnly=true')
      .set(as('organizer'))
      .expect(200);

    expect(afterReadAll.body.unreadCount).toBe(0);
    expect(afterReadAll.body.data).toHaveLength(0);
  });

  it('cancelamento de evento gera event_cancelled e estorno gera order_refunded para o comprador', async () => {
    // Cancela o evento antes do estorno (enquanto o ingresso ainda está ativo)
    await http().delete(`/events/${eventId}`).set(as('organizer')).expect(204);

    const afterEventCancel = await http()
      .get('/notifications')
      .set(as('buyer'))
      .expect(200);

    expect(
      afterEventCancel.body.data.map((n: { type: string }) => n.type),
    ).toContain('event_cancelled');

    // Estorna o pedido pago
    const ordersRes = await http().get('/orders').set(as('admin')).expect(200);
    const paidOrderId = ordersRes.body[0].id as string;

    await http()
      .patch(`/orders/${paidOrderId}/payments`)
      .set(as('admin'))
      .send({ status: 'estornado' })
      .expect(200);

    const afterRefund = await http()
      .get('/notifications')
      .set(as('buyer'))
      .expect(200);

    expect(
      afterRefund.body.data.map((n: { type: string }) => n.type),
    ).toContain('order_refunded');
  });

  it('cancelamento manual de pedido pendente gera order_cancelled para o comprador', async () => {
    // Reabre um lote extra ou usa outro pedido antes do evento ser cancelado?
    // Como o evento atual foi cancelado no teste anterior, criamos um novo pedido se reativarmos ou testamos via service
    await pglite.query(
      `UPDATE "events" SET "status" = 'published' WHERE "id" = $1`,
      [eventId],
    );

    const orderRes = await http()
      .post('/orders')
      .set(as('buyer'))
      .send({ items: [{ ticketTypeId, quantity: 1 }] })
      .expect(201);

    await http()
      .delete(`/orders/${orderRes.body.id}`)
      .set(as('buyer'))
      .expect(204);

    const notifs = await http()
      .get('/notifications?unreadOnly=true')
      .set(as('buyer'))
      .expect(200);

    expect(notifs.body.data.map((n: { type: string }) => n.type)).toContain(
      'order_cancelled',
    );
  });
});
