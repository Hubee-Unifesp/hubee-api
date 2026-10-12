import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

describe('Users endpoints (Postgres em memória)', () => {
  let app: INestApplication;
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;
  let users: UsersService;
  let jwt: JwtService;

  let mariaToken: string;
  let mariaId: string;
  let mariaEmail = 'maria@example.com';
  let joaoId: string;
  let adminToken: string;

  const http = () => request(app.getHttpServer());

  const register = async (email: string) => {
    const response = await http()
      .post('/auth/register')
      .send({ fullName: 'Fulano', email, password: 'secret123' })
      .expect(201);
    return {
      token: response.body.access_token as string,
      id: response.body.user.id as string,
    };
  };

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(
      readFileSync(
        'src/database/migrations/0000_lyrical_spencer_smythe.sql',
        'utf8',
      ),
    );
    await pg.exec(
      readFileSync(
        'src/database/migrations/0001_authentication_base.sql',
        'utf8',
      ),
    );
    db = drizzle(pg, { schema });
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [UsersController, AuthController],
      providers: [
        AuthService,
        UsersService,
        JwtAuthGuard,
        RolesGuard,
        { provide: DRIZZLE, useValue: db },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    users = module.get(UsersService);
    jwt = module.get(JwtService);

    const maria = await register(mariaEmail);
    mariaToken = maria.token;
    mariaId = maria.id;
    joaoId = (await register('joao@example.com')).id;

    const admin = await register('admin@example.com');
    await db
      .update(schema.users)
      .set({ role: 'ADMIN' })
      .where(eq(schema.users.id, admin.id));
    adminToken = await jwt.signAsync({
      sub: admin.id,
      email: 'admin@example.com',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app?.close();
    await pg?.close();
  });

  describe('proteção das rotas', () => {
    it('sem token todas as rotas respondem 401', async () => {
      await http().get('/users').expect(401);
      await http().get(`/users/${joaoId}`).expect(401);
      await http().patch('/users/me').send({ fullName: 'X' }).expect(401);
      await http()
        .patch('/users/me/senha')
        .send({ currentPassword: 'a', newPassword: 'bbbbbb' })
        .expect(401);
      await http().delete('/users/me').expect(401);
    });

    it('USER recebe 403 nas rotas administrativas', async () => {
      const auth = { Authorization: `Bearer ${mariaToken}` };
      await http().get('/users').set(auth).expect(403);
      await http().get(`/users/${joaoId}`).set(auth).expect(403);
      await http()
        .patch(`/users/${joaoId}`)
        .set(auth)
        .send({ fullName: 'Invadido' })
        .expect(403);
      await http().delete(`/users/${joaoId}`).set(auth).expect(403);
      await http()
        .post('/users')
        .set(auth)
        .send({
          fullName: 'Novo',
          email: 'novo@example.com',
          password: 'secret123',
        })
        .expect(403);
    });

    it('ADMIN continua usando as rotas /users/:id', async () => {
      const auth = { Authorization: `Bearer ${adminToken}` };
      const list = await http().get('/users').set(auth).expect(200);
      expect(list.body.length).toBeGreaterThanOrEqual(3);
      await http().get(`/users/${joaoId}`).set(auth).expect(200);
      const patched = await http()
        .patch(`/users/${joaoId}`)
        .set(auth)
        .send({ fullName: 'João Editado' })
        .expect(200);
      expect(patched.body.fullName).toBe('João Editado');
    });
  });

  describe('PATCH /users/me', () => {
    it('altera só os dados do token e devolve sem senha', async () => {
      const response = await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({
          fullName: ' Maria Nova ',
          email: ' MARIA.NOVA@Example.COM ',
          phone: '11999999999',
          birthDate: '1990-01-01',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        id: mariaId,
        fullName: 'Maria Nova',
        email: 'maria.nova@example.com',
        phone: '11999999999',
        birthDate: '1990-01-01',
        role: 'USER',
      });
      expect(response.body).not.toHaveProperty('password');
      mariaEmail = 'maria.nova@example.com';
      const other = await users.findOne(joaoId);
      expect(other.fullName).toBe('João Editado');
    });

    it.each([
      { cpf: '12345678901' },
      { role: 'ADMIN' },
      { status: 'BLOCKED' },
      { password: 'novaSenha1' },
      { signupIntent: 'BUY' },
    ])('rejeita campo proibido %j com 400', async (payload) => {
      await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send(payload)
        .expect(400);
      const after = await users.findOne(mariaId);
      expect(after.role).toBe('USER');
      expect(after.cpf).toBeNull();
      expect(after.status).toBe('ACTIVE');
    });

    it('e-mail de outro usuário ativo resulta em 409', async () => {
      await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ email: 'joao@example.com' })
        .expect(409);
    });
  });

  describe('PATCH /users/me/senha', () => {
    it('senha atual errada resulta em 401', async () => {
      await http()
        .patch('/users/me/senha')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ currentPassword: 'errada123', newPassword: 'novaSenha1' })
        .expect(401);
      await http()
        .post('/auth/login')
        .send({ email: mariaEmail, password: 'secret123' })
        .expect(200);
    });

    it('nova senha curta resulta em 400', async () => {
      await http()
        .patch('/users/me/senha')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ currentPassword: 'secret123', newPassword: '123' })
        .expect(400);
    });

    it('com a senha correta, o login só funciona com a senha nova', async () => {
      await http()
        .patch('/users/me/senha')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ currentPassword: 'secret123', newPassword: 'novaSenha1' })
        .expect(204);
      await http()
        .post('/auth/login')
        .send({ email: mariaEmail, password: 'secret123' })
        .expect(401);
      await http()
        .post('/auth/login')
        .send({ email: mariaEmail, password: 'novaSenha1' })
        .expect(200);
    });
  });

  describe('DELETE /users/me', () => {
    it('exclui a conta, bloqueia o login e libera e-mail e CPF', async () => {
      await db
        .update(schema.users)
        .set({ cpf: '12345678901' })
        .where(eq(schema.users.id, mariaId));

      await http()
        .delete('/users/me')
        .set('Authorization', `Bearer ${mariaToken}`)
        .expect(204);

      await http()
        .post('/auth/login')
        .send({ email: mariaEmail, password: 'novaSenha1' })
        .expect(401);

      const again = await http()
        .post('/auth/register')
        .send({
          fullName: 'Maria Voltou',
          email: mariaEmail,
          password: 'secret123',
        })
        .expect(201);
      await expect(
        users.update(again.body.user.id, { cpf: '12345678901' }),
      ).resolves.toMatchObject({ cpf: '12345678901' });
    });

    it('o token antigo da conta excluída não acessa mais os dados', async () => {
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${mariaToken}`)
        .expect(404);
    });
  });
});
