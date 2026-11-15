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

  describe('avaliações de fornecedores (GOL-245)', () => {
    let supplierId: string;

    beforeAll(async () => {
      const res = await http()
        .post('/suppliers')
        .set(as('organizer'))
        .send({ companyName: 'Doces da Vovó', cnpjCpf: '66777888000136' })
        .expect(201);
      supplierId = res.body.id;
    });

    const review = (user: string, body: object, id = supplierId) =>
      http().post(`/suppliers/${id}/reviews`).set(as(user)).send(body);

    it('bloqueia sem token (401) e comprador ou convite pendente (403)', async () => {
      await http()
        .post(`/suppliers/${supplierId}/reviews`)
        .send({ rating: 5 })
        .expect(401);
      await http().get(`/suppliers/${supplierId}/reviews`).expect(401);

      for (const role of ['buyer', 'pending']) {
        await review(role, { rating: 5 }).expect(403);
        await http()
          .get(`/suppliers/${supplierId}/reviews`)
          .set(as(role))
          .expect(403);
      }
    });

    it('cria a avaliação com 201 e atualiza a mesma avaliação com 200', async () => {
      const created = await review('organizer', {
        rating: 4,
        comment: '  Doces ótimos, entrega atrasou um pouco.  ',
      }).expect(201);

      expect(created.body).toMatchObject({
        supplierId,
        userName: 'organizer',
        rating: 4,
        comment: 'Doces ótimos, entrega atrasou um pouco.',
      });

      const updated = await review('organizer', { rating: 5 }).expect(200);

      expect(updated.body).toMatchObject({
        id: created.body.id,
        rating: 5,
        comment: null,
      });
      expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.body.updatedAt).getTime(),
      );
    });

    it('lista as avaliações do fornecedor das mais recentes para as mais antigas', async () => {
      await review('readOnly', { rating: 3, comment: 'Ok.' }).expect(201);
      await review('admin', { rating: 2 }).expect(201);

      const res = await http()
        .get(`/suppliers/${supplierId}/reviews`)
        .set(as('readOnly'))
        .expect(200);

      expect(res.body.map((r: { userName: string }) => r.userName)).toEqual([
        'admin',
        'readOnly',
        'organizer',
      ]);
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        supplierId,
        userId: expect.any(String),
        userName: 'admin',
        rating: 2,
        comment: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it.each([0, 6, 3.5, '5', null])(
      'rejeita nota %p com 400 em português',
      async (rating) => {
        const res = await review('organizer', { rating }).expect(400);
        expect(res.body.message.join(' ')).toMatch(/nota/i);
      },
    );

    it('rejeita comentário com mais de 500 caracteres e campos extras', async () => {
      const long = await review('organizer', {
        rating: 5,
        comment: 'a'.repeat(501),
      }).expect(400);
      expect(long.body.message).toContain(
        'O comentário deve ter no máximo 500 caracteres.',
      );

      await review('organizer', { rating: 5, userId: supplierId }).expect(400);
    });

    it('retorna 404 para fornecedor inexistente ou removido', async () => {
      const missing = '11111111-1111-4111-8111-111111111111';
      await review('organizer', { rating: 5 }, missing).expect(404);
      await http()
        .get(`/suppliers/${missing}/reviews`)
        .set(as('organizer'))
        .expect(404);

      const removed = await http()
        .post('/suppliers')
        .set(as('organizer'))
        .send({ companyName: 'Fechou as Portas', cnpjCpf: '77888999000147' })
        .expect(201);
      await http()
        .delete(`/suppliers/${removed.body.id}`)
        .set(as('organizer'))
        .expect(204);

      const res = await review('organizer', { rating: 5 }, removed.body.id);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Fornecedor não encontrado.');
      await http()
        .get(`/suppliers/${removed.body.id}/reviews`)
        .set(as('organizer'))
        .expect(404);
    });
  });
});
