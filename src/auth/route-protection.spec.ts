import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { INestApplication, RequestMethod, Type } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { EventController } from '../event/event.controller';
import { EventService } from '../event/event.service';
import { ExpensesController } from '../expenses/expenses.controller';
import { OrganizationEventController } from '../organization-event/organization-event.controller';
import { OrganizationUsersController } from '../organization-users/organization-users.controller';
import { OrderController } from '../order/order.controller';
import { OrganizationController } from '../organization/organization.controller';
import { PaymentController } from '../payment/payment.controller';
import { SuppliersController } from '../suppliers/suppliers.controller';
import { TaskController } from '../task/task.controller';
import { TicketController } from '../ticket/ticket.controller';
import { TicketTypeController } from '../ticket-type/ticket-type.controller';
import { VenueController } from '../venue/venue.controller';

/**
 * Controllers cobertos pela GOL-114. Users fica na GOL-105; o resto de orders
 * (checagem de dono) na GOL-103.
 */
const CONTROLLERS: Type[] = [
  EventController,
  TicketTypeController,
  OrganizationController,
  VenueController,
  SuppliersController,
  ExpensesController,
  TaskController,
  PaymentController,
  TicketController,
  OrderController,
  OrganizationUsersController,
  OrganizationEventController,
];

/**
 * Únicas rotas desses controllers que continuam públicas: a home do front
 * lista eventos, organizações, locais e tipos de ingresso sem login.
 * Qualquer rota fora das listas abaixo precisa exigir token de ADMIN.
 */
const PUBLIC_ROUTES = [
  'GET /events',
  'GET /events/summary',
  'GET /events/:id',
  'GET /events/:eventId/ticket-types',
  'GET /events/:eventId/ticket-types/:id',
  'GET /organizations',
  'GET /organizations/:id',
  'GET /venues',
  'GET /venues/:id',
];

/**
 * Qualquer usuário logado: o comprador paga e consulta o próprio pedido. O
 * service responde 404 para recurso de outra pessoa (coberto nos specs dos
 * services, já que aqui o service é falso).
 */
const AUTHENTICATED_ROUTES = [
  'POST /orders/:orderId/payments',
  'GET /orders/:orderId/payments',
  'GET /orders/:orderId/tickets',
  'GET /tickets/:id',
];

/** Rotas de pedido que ganham proteção com checagem de dono na GOL-103. */
const PENDING_GOL_103_ROUTES = [
  'POST /orders',
  'GET /orders',
  'GET /orders/:id',
  'DELETE /orders/:id',
];

// Chaves de metadata que o Nest grava via @Controller/@Get/@Post/... (as
// constantes não são exportadas publicamente pelo @nestjs/common).
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';
interface Route {
  method: HttpMethod;
  template: string;
  label: string;
}

const METHOD_NAMES: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

/** Lê as rotas declaradas no controller, sem depender de lista manual. */
function routesOf(controller: Type): Route[] {
  const base: string = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler = controller.prototype[name];
    const path: string | undefined = Reflect.getMetadata(
      PATH_METADATA,
      handler,
    );
    if (path === undefined || name === 'constructor') return [];
    const method = METHOD_NAMES[Reflect.getMetadata(METHOD_METADATA, handler)];
    if (!method) return [];
    const template =
      '/' + [base, path].filter((part) => part && part !== '/').join('/');
    return [{ method, template, label: `${method.toUpperCase()} ${template}` }];
  });
}

/** Service falso: todo método resolve com um objeto vazio. */
function mockServiceOf(controller: Type) {
  const [serviceClass]: Type[] = Reflect.getMetadata(
    'design:paramtypes',
    controller,
  );
  const methods = Object.getOwnPropertyNames(serviceClass.prototype).filter(
    (name) => name !== 'constructor',
  );
  const mock = Object.fromEntries(
    methods.map((name) => [name, jest.fn(async () => ({}))]),
  );
  return { provide: serviceClass, useValue: mock };
}

const ID = '11111111-1111-4111-8111-111111111111';
const ROUTES = CONTROLLERS.flatMap(routesOf);
const publicRoutes = ROUTES.filter((r) => PUBLIC_ROUTES.includes(r.label));
const authenticatedRoutes = ROUTES.filter((r) =>
  AUTHENTICATED_ROUTES.includes(r.label),
);
const protectedRoutes = ROUTES.filter(
  (r) =>
    ![
      ...PUBLIC_ROUTES,
      ...AUTHENTICATED_ROUTES,
      ...PENDING_GOL_103_ROUTES,
    ].includes(r.label),
);

describe('Proteção de rotas (GOL-114)', () => {
  let app: INestApplication;
  let userToken: string;
  let adminToken: string;

  const call = (route: Route, token?: string) => {
    const req = request(app.getHttpServer())[route.method](
      route.template.replace(/:\w+/g, ID),
    );
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: CONTROLLERS,
      providers: CONTROLLERS.map(mockServiceOf),
    }).compile();
    app = module.createNestApplication();
    await app.init();

    const jwt = module.get(JwtService);
    userToken = await jwt.signAsync({
      sub: 'user-id',
      email: 'user@example.com',
      role: 'USER',
    });
    adminToken = await jwt.signAsync({
      sub: 'admin-id',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('documentação OpenAPI', () => {
    let document: ReturnType<typeof SwaggerModule.createDocument>;
    const operationOf = (route: Route) => {
      document ??= SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      const path = route.template.replace(/:(\w+)/g, '{$1}');
      return document.paths[path]?.[route.method];
    };

    it.each(protectedRoutes.map((r) => [r.label, r] as const))(
      '%s documenta Bearer e respostas 401/403',
      (_label, route) => {
        const operation = operationOf(route);
        expect(operation?.security).toEqual([{ bearer: [] }]);
        expect(Object.keys(operation?.responses ?? {})).toEqual(
          expect.arrayContaining(['401', '403']),
        );
      },
    );

    it.each(authenticatedRoutes.map((r) => [r.label, r] as const))(
      '%s documenta Bearer e resposta 401',
      (_label, route) => {
        const operation = operationOf(route);
        expect(operation?.security).toEqual([{ bearer: [] }]);
        expect(Object.keys(operation?.responses ?? {})).toContain('401');
      },
    );

    it.each(publicRoutes.map((r) => [r.label, r] as const))(
      '%s não exige token',
      (_label, route) => {
        const operation = operationOf(route);
        expect(operation).toBeDefined();
        expect(operation?.security).toBeUndefined();
      },
    );
  });

  it('toda rota das listas existe nos controllers', () => {
    const labels = ROUTES.map((r) => r.label);
    for (const route of [
      ...PUBLIC_ROUTES,
      ...AUTHENTICATED_ROUTES,
      ...PENDING_GOL_103_ROUTES,
    ])
      expect(labels).toContain(route);
    expect(protectedRoutes.length).toBeGreaterThan(0);
  });

  it.each([
    'PATCH /orders/:orderId/payments',
    'POST /orders/:orderId/tickets',
    'PATCH /tickets/:id',
    'PATCH /orders/:id',
  ])('%s é só ADMIN', (label) => {
    expect(protectedRoutes.map((r) => r.label)).toContain(label);
  });

  describe.each(publicRoutes.map((r) => [r.label, r] as const))(
    '%s (pública)',
    (_label, route) => {
      it('responde sem token', async () => {
        const response = await call(route);
        expect(response.status).toBeLessThan(300);
      });

      it('responde com token de USER', async () => {
        const response = await call(route, userToken);
        expect(response.status).toBeLessThan(300);
      });
    },
  );

  describe('eventos não publicados', () => {
    const eventService = () =>
      app.get(EventService) as unknown as {
        findAll: jest.Mock;
        findVisible: jest.Mock;
      };

    it('GET /events?status=draft sem token repassa o filtro sem usuário', async () => {
      await request(app.getHttpServer())
        .get('/events?status=draft')
        .expect(200);
      expect(eventService().findAll).toHaveBeenLastCalledWith(
        { status: 'draft' },
        undefined,
      );
    });

    it('GET /events com token de ADMIN repassa o ADMIN para o service', async () => {
      await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(eventService().findAll).toHaveBeenLastCalledWith(
        {},
        expect.objectContaining({ role: 'ADMIN' }),
      );
    });

    it('GET /events/:id com token inválido dá 401 em vez da visão pública', async () => {
      await request(app.getHttpServer())
        .get(`/events/${ID}`)
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });
  });

  describe.each(authenticatedRoutes.map((r) => [r.label, r] as const))(
    '%s (qualquer usuário logado)',
    (_label, route) => {
      it('401 sem token', async () => {
        await call(route).expect(401);
      });

      it('401 com token inválido', async () => {
        await call(route, 'token-invalido').expect(401);
      });

      it.each([
        ['USER', () => userToken],
        ['ADMIN', () => adminToken],
      ])('2xx com token de %s', async (_role, token) => {
        const response = await call(route, token());
        expect(response.status).toBeLessThan(300);
      });
    },
  );

  describe.each(protectedRoutes.map((r) => [r.label, r] as const))(
    '%s (só ADMIN)',
    (_label, route) => {
      it('401 sem token', async () => {
        await call(route).expect(401);
      });

      it('401 com token inválido', async () => {
        await call(route, 'token-invalido').expect(401);
      });

      it('403 com token de USER', async () => {
        await call(route, userToken).expect(403);
      });

      it('2xx com token de ADMIN', async () => {
        const response = await call(route, adminToken);
        expect(response.status).toBeLessThan(300);
      });
    },
  );
});
