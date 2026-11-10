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
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

describe('Fornecedores por organizadores (GOL-202, banco em memória)', () => {
  let app: INestApplication;
  let pglite: PGlite;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (name: string) => ({ Authorization: `Bearer ${tokens[name]}` });

  beforeAll(async () => {
    pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    const { apply } = await pushSchema(schema as never, db as never);
    await apply();

    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [SuppliersController],
      providers: [SuppliersService, { provide: DRIZZLE, useValue: db }],
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

    const [org] = await db
      .insert(schema.organizations)
      .values([{ name: 'Hubee Produções' }])
      .returning();

    const names = ['organizer', 'readOnly', 'pending', 'buyer', 'admin'];
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
        orgId: org.id,
        userId: idOf.organizer,
        role: 'member',
        permission: 'full',
        inviteStatus: 'accepted',
      },
      {
        orgId: org.id,
        userId: idOf.readOnly,
        role: 'member',
        permission: 'read_only',
        inviteStatus: 'accepted',
      },
      {
        orgId: org.id,
        userId: idOf.pending,
        role: 'admin',
        permission: 'full',
        inviteStatus: 'pending',
      },
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

  describe('controle de acesso (RBAC)', () => {
    it('bloqueia acesso sem token com 401', async () => {
      await http().get('/suppliers').expect(401);
      await http()
        .post('/suppliers')
        .send({ companyName: 'Teste', cnpjCpf: '12345678000190' })
        .expect(401);
    });

    it('bloqueia comprador comum e convite pendente com 403', async () => {
      for (const role of ['buyer', 'pending']) {
        await http().get('/suppliers').set(as(role)).expect(403);
        await http()
          .post('/suppliers')
          .set(as(role))
          .send({ companyName: 'Teste', cnpjCpf: '12345678000190' })
          .expect(403);
      }
    });

    it('permite CRUD completo para organizador autenticado e para ADMIN', async () => {
      const created = await http()
        .post('/suppliers')
        .set(as('organizer'))
        .send({
          companyName: 'Buffet Sabor Real',
          cnpjCpf: '11222333000181',
          phone: '11988887777',
          email: 'contato@saborreal.com.br',
          category: 'Buffet',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        companyName: 'Buffet Sabor Real',
        cnpjCpf: '11222333000181',
        category: 'Buffet',
      });
      expect(created.body.deletedAt).toBeUndefined();

      const id = created.body.id;

      // Detalhar
      await http()
        .get(`/suppliers/${id}`)
        .set(as('readOnly'))
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(id);
        });

      // Editar
      const updated = await http()
        .patch(`/suppliers/${id}`)
        .set(as('organizer'))
        .send({ companyName: 'Buffet Sabor Real Premium' })
        .expect(200);

      expect(updated.body.companyName).toBe('Buffet Sabor Real Premium');

      // Remover
      await http().delete(`/suppliers/${id}`).set(as('organizer')).expect(204);

      // Após remoção lógica, retorna 404
      await http().get(`/suppliers/${id}`).set(as('admin')).expect(404);
    });
  });

  describe('conflito de CNPJ/CPF e e-mail (409 Conflict)', () => {
    it('retorna 409 em português ao cadastrar CNPJ/CPF ou e-mail já ativo', async () => {
      await http()
        .post('/suppliers')
        .set(as('organizer'))
        .send({
          companyName: 'Som & Luz Eventos',
          cnpjCpf: '22333444000192',
          email: 'someluz@eventos.com',
          category: 'Som e iluminação',
        })
        .expect(201);

      const dupDoc = await http()
        .post('/suppliers')
        .set(as('organizer'))
        .send({
          companyName: 'Outra Empresa',
          cnpjCpf: '22333444000192',
          email: 'outro@eventos.com',
        })
        .expect(409);

      expect(dupDoc.body.message).toBe(
        'Já existe um fornecedor com este CNPJ/CPF ou E-mail.',
      );

      const dupEmail = await http()
        .post('/suppliers')
        .set(as('organizer'))
        .send({
          companyName: 'Mais Uma Empresa',
          cnpjCpf: '33444555000103',
          email: 'someluz@eventos.com',
        })
        .expect(409);

      expect(dupEmail.body.message).toBe(
        'Já existe um fornecedor com este CNPJ/CPF ou E-mail.',
      );
    });
  });

  describe('filtros de busca em GET /suppliers', () => {
    beforeAll(async () => {
      await http().post('/suppliers').set(as('organizer')).send({
        companyName: 'Foto Flash Studio',
        cnpjCpf: '44555666000114',
        category: 'Fotografia',
      });
      await http().post('/suppliers').set(as('organizer')).send({
        companyName: 'Segurança Total Ltda',
        cnpjCpf: '55666777000125',
        category: 'Segurança',
      });
    });

    it('filtra por search (companyName case-insensitive)', async () => {
      const res = await http()
        .get('/suppliers?search=flash')
        .set(as('organizer'))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].companyName).toBe('Foto Flash Studio');
    });

    it('filtra por category (case-insensitive)', async () => {
      const res = await http()
        .get('/suppliers?category=seguran%C3%A7a')
        .set(as('organizer'))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].companyName).toBe('Segurança Total Ltda');
    });

    it('combina search e category e retorna lista vazia quando não há match', async () => {
      const match = await http()
        .get('/suppliers?search=Foto&category=Fotografia')
        .set(as('organizer'))
        .expect(200);
      expect(match.body).toHaveLength(1);

      const empty = await http()
        .get('/suppliers?search=Foto&category=Buffet')
        .set(as('organizer'))
        .expect(200);
      expect(empty.body).toEqual([]);
    });
  });
});
