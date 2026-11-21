/**
 * Teste com banco de verdade (Postgres em memória via PGlite — não precisa de Docker).
 *
 * Instalação:
 *   npm i -D @electric-sql/pglite
 *   (drizzle-kit já deve estar no projeto)
 *
 * Este arquivo é o que satisfaz o critério de aceite "teste com banco cobre
 * criação e atualização": ele pega erros de mapeamento coluna/propriedade que
 * o spec com mocks nunca veria.
 *
 * ATENÇÃO: os inserts de organização e usuário abaixo são um esqueleto —
 * ajuste os campos para o que organizations e users realmente exigem.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { OrganizationRepository } from '../organization/organization.repository';
import { OrganizationService } from '../organization/organization.service';
import { UsersService } from '../users/users.service';
import { OrganizationUsersController } from './organization-users.controller';
import { OrganizationUsersService } from './organization-users.service';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './dto/create-organization-user.dto';

describe('OrganizationUsersService (banco real)', () => {
  let db: any;
  let pglite: PGlite;
  let service: OrganizationUsersService;

  let orgId: string;
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite, { schema });

    const { apply } = await pushSchema(schema as any, db);
    await apply();

    const usersService = new UsersService(db);
    service = new OrganizationUsersService(
      db,
      { findOne: async () => ({}) } as any,
      usersService,
    );
  });

  afterAll(async () => {
    await pglite.close();
  });

  beforeEach(async () => {
    await db.delete(schema.organizationUsers);
    await db.delete(schema.organizations);
    await db.delete(schema.users);

    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Organização de Teste',
        description: 'Uma organização para testes de integração',
      })
      .returning();
    orgId = org.id;

    userEmail = `teste-${Date.now()}@exemplo.com`;
    const [user] = await db
      .insert(schema.users)
      .values({
        fullName: 'Usuário Teste',
        email: userEmail,
        password: 'hashed_password_123',
        cpf: `${Date.now().toString().slice(-11)}`,
        birthDate: '1990-01-01',
        role: 'USER',
      })
      .returning();
    userId = user.id;
  });

  const readMembership = async () => {
    const [linha] = await db
      .select()
      .from(schema.organizationUsers)
      .where(eq(schema.organizationUsers.userId, userId));
    return linha;
  };

  it('create persiste role e permission por email com status pending', async () => {
    const retorno = await service.create(orgId, {
      email: userEmail,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    expect(retorno).toMatchObject({
      orgId,
      userId,
      userName: 'Usuário Teste',
      userEmail,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.PENDING,
    });

    await expect(readMembership()).resolves.toMatchObject({
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.PENDING,
    });
  });

  it('update persiste inviteStatus sem apagar role e permission', async () => {
    await service.create(orgId, {
      email: userEmail,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    await service.update(orgId, userId, {
      inviteStatus: InviteStatus.ACCEPTED,
    });

    await expect(readMembership()).resolves.toMatchObject({
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.ACCEPTED,
    });
  });

  it('update persiste role e permission e devolve userName/userEmail', async () => {
    await service.create(orgId, {
      email: userEmail,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    const updated = await service.update(orgId, userId, {
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.READ_ONLY,
    });

    expect(updated).toMatchObject({
      userName: 'Usuário Teste',
      userEmail,
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.READ_ONLY,
    });
  });

  it('update atualiza updatedAt', async () => {
    await service.create(orgId, {
      email: userEmail,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });
    const before = await readMembership();

    await new Promise((r) => setTimeout(r, 10));
    await service.update(orgId, userId, { role: OrganizationRole.MEMBER });
    const after = await readMembership();

    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
      new Date(before.updatedAt).getTime(),
    );
  });

  it('remove apaga a linha', async () => {
    await service.create(orgId, {
      email: userEmail,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    await service.remove(orgId, userId);

    await expect(readMembership()).resolves.toBeUndefined();
  });
});

describe('Convites e permissões de membros da organização (GOL-275, HTTP + PGlite)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let orgId: string;
  let otherOrgId: string;
  const tokens: Record<string, string> = {};
  const userIds: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as any, db as any);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [OrganizationUsersController],
      providers: [
        OrganizationUsersService,
        OrganizationService,
        OrganizationRepository,
        UsersService,
        { provide: DRIZZLE, useValue: db },
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

    const [org, otherOrg] = await db
      .insert(schema.organizations)
      .values([{ name: 'Atlética Unifesp' }, { name: 'Outra Organização' }])
      .returning();
    orgId = org.id;
    otherOrgId = otherOrg.id;

    const specs = [
      { key: 'manager', fullName: 'Ana Gestora', role: 'USER' as const },
      { key: 'writer', fullName: 'Bruno Editor', role: 'USER' as const },
      { key: 'reader', fullName: 'Carla Leitura', role: 'USER' as const },
      { key: 'outsider', fullName: 'Diego Fora', role: 'USER' as const },
      { key: 'invitee1', fullName: 'Eva Convidada', role: 'USER' as const },
      { key: 'invitee2', fullName: 'Felipe Convidado', role: 'USER' as const },
      {
        key: 'inactive',
        fullName: 'Gustavo Inativo',
        role: 'USER' as const,
        status: 'INACTIVE',
      },
      { key: 'admin', fullName: 'Admin Global', role: 'ADMIN' as const },
    ];

    const createdUsers = await db
      .insert(schema.users)
      .values(
        specs.map((spec) => ({
          fullName: spec.fullName,
          email: `${spec.key}@exemplo.com`,
          password: 'hash',
          role: spec.role,
          status: spec.status ?? 'ACTIVE',
        })),
      )
      .returning();

    const jwt = module.get(JwtService);
    for (let i = 0; i < specs.length; i++) {
      const key = specs[i].key;
      const user = createdUsers[i];
      userIds[key] = user.id;
      tokens[key] = await jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    }

    await db.insert(schema.organizationUsers).values([
      {
        orgId,
        userId: userIds.manager,
        role: 'admin',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId,
        userId: userIds.writer,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId,
        userId: userIds.reader,
        role: 'member',
        permission: 'read_only',
        inviteStatus: 'accepted',
      },
    ]);
  });

  afterAll(async () => {
    await app?.close();
    await pglite?.close();
  });

  it('bloqueia acesso sem token (401), read/write (403) e não-membro (404) nas rotas de gestão', async () => {
    await http().get(`/organizations/${orgId}/users`).expect(401);
    await http()
      .post(`/organizations/${orgId}/users`)
      .send({
        email: 'invitee1@exemplo.com',
        role: 'member',
        permission: 'full',
      })
      .expect(401);

    for (const memberKey of ['reader', 'writer']) {
      await http()
        .get(`/organizations/${orgId}/users`)
        .set(as(memberKey))
        .expect(403);
      await http()
        .post(`/organizations/${orgId}/users`)
        .set(as(memberKey))
        .send({
          email: 'invitee1@exemplo.com',
          role: 'member',
          permission: 'full',
        })
        .expect(403);
      await http()
        .patch(`/organizations/${orgId}/users/${userIds.writer}`)
        .set(as(memberKey))
        .send({ permission: 'read_only' })
        .expect(403);
      await http()
        .delete(`/organizations/${orgId}/users/${userIds.writer}`)
        .set(as(memberKey))
        .expect(403);
    }

    await http()
      .get(`/organizations/${orgId}/users`)
      .set(as('outsider'))
      .expect(404);
    await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('outsider'))
      .send({
        email: 'invitee1@exemplo.com',
        role: 'member',
        permission: 'full',
      })
      .expect(404);
  });

  it('organizador (manage) convida por email (201), lista com userName/userEmail, edita e remove membro', async () => {
    await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('manager'))
      .send({
        email: 'nao-existe@exemplo.com',
        role: 'member',
        permission: 'full',
      })
      .expect(404);

    await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('manager'))
      .send({
        email: 'inactive@exemplo.com',
        role: 'member',
        permission: 'full',
      })
      .expect(404);

    const inviteRes = await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('manager'))
      .send({
        email: '  INVITEE1@EXEMPLO.COM  ',
        role: 'member',
        permission: 'full',
      })
      .expect(201);

    expect(inviteRes.body).toMatchObject({
      orgId,
      userId: userIds.invitee1,
      userName: 'Eva Convidada',
      userEmail: 'invitee1@exemplo.com',
      role: 'member',
      permission: 'full',
      inviteStatus: 'pending',
    });

    await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('manager'))
      .send({
        email: 'invitee1@exemplo.com',
        role: 'member',
        permission: 'read_only',
      })
      .expect(409);

    // Convidado ainda pendente recebe 404 na gestão da organização
    await http()
      .get(`/organizations/${orgId}/users`)
      .set(as('invitee1'))
      .expect(404);

    const listRes = await http()
      .get(`/organizations/${orgId}/users`)
      .set(as('manager'))
      .expect(200);

    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: userIds.manager,
          userName: 'Ana Gestora',
          userEmail: 'manager@exemplo.com',
        }),
        expect.objectContaining({
          userId: userIds.invitee1,
          userName: 'Eva Convidada',
          userEmail: 'invitee1@exemplo.com',
          inviteStatus: 'pending',
        }),
      ]),
    );

    const updatedRes = await http()
      .patch(`/organizations/${orgId}/users/${userIds.invitee1}`)
      .set(as('manager'))
      .send({ role: 'admin', permission: 'read_only' })
      .expect(200);

    expect(updatedRes.body).toMatchObject({
      userId: userIds.invitee1,
      userName: 'Eva Convidada',
      userEmail: 'invitee1@exemplo.com',
      role: 'admin',
      permission: 'read_only',
    });

    // ADMIN global também pode gerenciar membros sem vínculo na organização
    await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('admin'))
      .send({
        email: 'invitee2@exemplo.com',
        role: 'member',
        permission: 'read_only',
      })
      .expect(201);

    await http()
      .delete(`/organizations/${orgId}/users/${userIds.invitee2}`)
      .set(as('manager'))
      .expect(204);

    // Recria o convite de invitee2 para testar recusa pelo convidado no teste seguinte
    await http()
      .post(`/organizations/${orgId}/users`)
      .set(as('manager'))
      .send({
        email: 'invitee2@exemplo.com',
        role: 'member',
        permission: 'read_only',
      })
      .expect(201);
  });

  it('convidado lista convites pendentes em GET /users/me/invites e aceita/recusa em PATCH /organizations/:orgId/users/me', async () => {
    await http().get('/users/me/invites').expect(401);
    await http()
      .patch(`/organizations/${orgId}/users/me`)
      .send({ inviteStatus: 'accepted' })
      .expect(401);

    // Convida invitee1 também na otherOrgId com role member para validar listagem múltipla
    await db.insert(schema.organizationUsers).values({
      orgId: otherOrgId,
      userId: userIds.invitee1,
      role: 'member',
      permission: 'read_only',
      inviteStatus: 'pending',
    });

    const myInvites = await http()
      .get('/users/me/invites')
      .set(as('invitee1'))
      .expect(200);

    expect(myInvites.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orgId,
          organizationName: 'Atlética Unifesp',
          userId: userIds.invitee1,
          role: 'admin',
          permission: 'read_only',
          inviteStatus: 'pending',
        }),
        expect.objectContaining({
          orgId: otherOrgId,
          organizationName: 'Outra Organização',
          userId: userIds.invitee1,
          role: 'member',
          permission: 'read_only',
          inviteStatus: 'pending',
        }),
      ]),
    );

    await http()
      .patch(`/organizations/${orgId}/users/me`)
      .set(as('invitee1'))
      .send({ inviteStatus: 'pending' })
      .expect(400);

    const accepted = await http()
      .patch(`/organizations/${orgId}/users/me`)
      .set(as('invitee1'))
      .send({ inviteStatus: 'accepted' })
      .expect(200);

    expect(accepted.body).toMatchObject({
      orgId,
      userId: userIds.invitee1,
      userName: 'Eva Convidada',
      userEmail: 'invitee1@exemplo.com',
      inviteStatus: 'accepted',
    });

    // Após aceitar em orgId, resta apenas otherOrgId em /users/me/invites
    const remainingInvites = await http()
      .get('/users/me/invites')
      .set(as('invitee1'))
      .expect(200);
    expect(remainingInvites.body).toHaveLength(1);
    expect(remainingInvites.body[0].orgId).toBe(otherOrgId);

    // Já aceito: tentar responder de novo retorna 404
    await http()
      .patch(`/organizations/${orgId}/users/me`)
      .set(as('invitee1'))
      .send({ inviteStatus: 'rejected' })
      .expect(404);

    // Agora invitee1 é membro aceito (read_only) em orgId, então vê 403 em rota manage (não mais 404)
    await http()
      .get(`/organizations/${orgId}/users`)
      .set(as('invitee1'))
      .expect(403);

    // Segundo convidado recusa o convite
    const rejected = await http()
      .patch(`/organizations/${orgId}/users/me`)
      .set(as('invitee2'))
      .send({ inviteStatus: 'rejected' })
      .expect(200);
    expect(rejected.body.inviteStatus).toBe('rejected');

    const invitee2List = await http()
      .get('/users/me/invites')
      .set(as('invitee2'))
      .expect(200);
    expect(invitee2List.body).toEqual([]);

    // Outsider sem convite na organização recebe 404
    await http()
      .patch(`/organizations/${orgId}/users/me`)
      .set(as('outsider'))
      .send({ inviteStatus: 'accepted' })
      .expect(404);

    // Confirma no banco os estados finais
    const [rowInvitee2] = await db
      .select()
      .from(schema.organizationUsers)
      .where(
        and(
          eq(schema.organizationUsers.orgId, orgId),
          eq(schema.organizationUsers.userId, userIds.invitee2),
        ),
      );
    expect(rowInvitee2.inviteStatus).toBe('rejected');
  });
});
