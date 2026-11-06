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
import { OrderService } from '../order/order.service';
import { StorageService } from '../storage/storage.service';
import { TicketService } from '../ticket/ticket.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

describe('Organizações — cadastro por usuário autenticado e vínculo de admin (GOL-197)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [OrganizationController, UsersController],
      providers: [
        OrganizationService,
        OrganizationRepository,
        UsersService,
        { provide: DRIZZLE, useValue: db },
        { provide: OrderService, useValue: { findAll: async () => [] } },
        { provide: TicketService, useValue: { findByUser: async () => [] } },
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

    const names = ['creator', 'writeMember', 'readMember', 'stranger', 'admin'];
    const users = await db
      .insert(schema.users)
      .values(
        names.map((name) => ({
          fullName: name,
          email: `${name}@example.com`,
          password: 'hashed-password',
          role: name === 'admin' ? ('ADMIN' as const) : ('USER' as const),
        })),
      )
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
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  it('usuário comum (USER) recebe 201 Created ao criar organização e GET /users/me retorna vínculo admin/full/manage', async () => {
    const created = await http()
      .post('/organizations')
      .set(as('creator'))
      .send({
        name: 'Atlética Unifesp',
        description: 'Associação Atlética Acadêmica',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'Atlética Unifesp',
      description: 'Associação Atlética Acadêmica',
      representativeId: userIds.creator,
    });

    const me = await http().get('/users/me').set(as('creator')).expect(200);
    expect(me.body.organizations).toEqual([
      {
        orgId: created.body.id,
        organizationName: 'Atlética Unifesp',
        role: 'admin',
        permission: 'full',
        level: 'manage',
      },
    ]);
  });

  describe('PATCH /organizations/:id — controle de acesso por nível na organização', () => {
    let orgId: string;

    beforeAll(async () => {
      const response = await http()
        .post('/organizations')
        .set(as('creator'))
        .send({
          name: 'Centro Acadêmico Ada Lovelace',
          description: 'Descrição original',
        })
        .expect(201);
      orgId = response.body.id;

      await db.insert(schema.organizationUsers).values([
        {
          orgId,
          userId: userIds.writeMember,
          role: 'member',
          permission: 'full',
          inviteStatus: 'accepted',
        },
        {
          orgId,
          userId: userIds.readMember,
          role: 'member',
          permission: 'read_only',
          inviteStatus: 'accepted',
        },
      ]);
    });

    it('usuário com permissão manage consegue atualizar name e description (200 OK)', async () => {
      const updated = await http()
        .patch(`/organizations/${orgId}`)
        .set(as('creator'))
        .send({
          name: 'CAAL Unifesp',
          description: 'Descrição atualizada pelo admin da organização',
        })
        .expect(200);

      expect(updated.body).toMatchObject({
        id: orgId,
        name: 'CAAL Unifesp',
        description: 'Descrição atualizada pelo admin da organização',
        representativeId: userIds.creator,
      });
    });

    it('membro da organização com permissão apenas write recebe 403 Forbidden ao tentar o PATCH', async () => {
      await http()
        .patch(`/organizations/${orgId}`)
        .set(as('writeMember'))
        .send({ name: 'Tentativa Write' })
        .expect(403);
    });

    it('membro da organização com permissão apenas read recebe 403 Forbidden ao tentar o PATCH', async () => {
      await http()
        .patch(`/organizations/${orgId}`)
        .set(as('readMember'))
        .send({ name: 'Tentativa Read' })
        .expect(403);
    });

    it('não-membro recebe 404 Not Found ao tentar o PATCH', async () => {
      await http()
        .patch(`/organizations/${orgId}`)
        .set(as('stranger'))
        .send({ name: 'Tentativa Stranger' })
        .expect(404);
    });
  });
});

