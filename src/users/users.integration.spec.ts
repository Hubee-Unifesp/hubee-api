import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

const VALID_CPF = '52998224725';
const OTHER_VALID_CPF = '11144477735';

describe('Users /me e controle de acesso (Postgres em memória)', () => {
  let app: INestApplication;
  let pg: PGlite;
  let jwt: JwtService;
  let adminToken: string;

  const http = () => request(app.getHttpServer());

  async function register(email: string, password = 'secret123') {
    const response = await http()
      .post('/auth/register')
      .send({ fullName: 'Pessoa Teste', email, password })
      .expect(201);
    return {
      id: response.body.user.id as string,
      token: response.body.access_token as string,
    };
  }

  beforeAll(async () => {
    pg = new PGlite();
    for (const migration of [
      '0000_lyrical_spencer_smythe',
      '0001_authentication_base',
    ]) {
      await pg.exec(
        readFileSync(`src/database/migrations/${migration}.sql`, 'utf8'),
      );
    }
    const db = drizzle(pg, { schema });
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [AuthController, UsersController],
      providers: [
        AuthService,
        UsersService,
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
    jwt = module.get(JwtService);

    const [admin] = await db
      .insert(schema.users)
      .values({
        fullName: 'Admin',
        email: 'admin@example.com',
        password: 'hash',
        role: 'ADMIN',
      })
      .returning();
    adminToken = await jwt.signAsync({
      sub: admin.id,
      email: admin.email,
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await app?.close();
    await pg?.close();
  });

  describe('PATCH /users/me', () => {
    it('completa o perfil com CPF e nascimento válidos', async () => {
      const { id, token } = await register('completa@example.com');
      const before = await http()
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(before.body).toMatchObject({ id, profileComplete: false });

      const response = await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpf: VALID_CPF, birthDate: '1990-05-20' })
        .expect(200);
      expect(response.body).toMatchObject({
        id,
        cpf: VALID_CPF,
        birthDate: '1990-05-20',
        profileComplete: true,
      });
      expect(response.body).not.toHaveProperty('password');

      const me = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(me.body.profileComplete).toBe(true);
    });

    it('edita nome, e-mail e telefone sem completar o perfil', async () => {
      const { token } = await register('edita@example.com');
      const response = await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: ' Nome Novo ',
          email: ' EDITADO@Example.com ',
          phone: '11999999999',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        fullName: 'Nome Novo',
        email: 'editado@example.com',
        phone: '11999999999',
        profileComplete: false,
      });
    });

    it('recusa CPF com dígito verificador inválido', async () => {
      const { token } = await register('cpf-invalido@example.com');
      const response = await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpf: '52998224724' })
        .expect(400);
      expect(response.body.message).toContain('CPF inválido');
    });

    it('recusa CPF já usado por outra conta ativa com 409', async () => {
      const { token } = await register('cpf-duplicado@example.com');
      await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpf: VALID_CPF })
        .expect(409);
    });

    it('não permite alterar um CPF já preenchido', async () => {
      const { token } = await register('cpf-fixo@example.com');
      await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpf: OTHER_VALID_CPF })
        .expect(200);
      const response = await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpf: '39053344705' })
        .expect(400);
      expect(response.body.message).toBe('CPF não pode ser alterado');

      await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ cpf: OTHER_VALID_CPF, fullName: 'Mesmo CPF' })
        .expect(200);
    });

    it('recusa data de nascimento no futuro', async () => {
      const { token } = await register('futuro@example.com');
      const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const response = await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ birthDate: tomorrow })
        .expect(400);
      expect(response.body.message).toContain(
        'A data de nascimento não pode estar no futuro',
      );
    });

    it.each([
      { role: 'ADMIN' },
      { status: 'ACTIVE' },
      { password: 'novasenha' },
      { signupIntent: 'BUY' },
    ])('recusa campo não editável %j', async (body) => {
      const { token } = await register(
        `campo-${Object.keys(body)[0]}@example.com`,
      );
      await http()
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
    });

    it('exige token', async () => {
      await http().patch('/users/me').send({ fullName: 'X' }).expect(401);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('recusa senha atual incorreta com 401', async () => {
      const { token } = await register('senha-errada@example.com');
      await http()
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'errada', newPassword: 'nova123' })
        .expect(401);
      await http()
        .post('/auth/login')
        .send({ email: 'senha-errada@example.com', password: 'secret123' })
        .expect(200);
    });

    it('troca a senha: só a nova funciona no login seguinte', async () => {
      const { token } = await register('troca@example.com');
      await http()
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'secret123', newPassword: 'nova123' })
        .expect(204);
      await http()
        .post('/auth/login')
        .send({ email: 'troca@example.com', password: 'secret123' })
        .expect(401);
      await http()
        .post('/auth/login')
        .send({ email: 'troca@example.com', password: 'nova123' })
        .expect(200);
    });

    it.each([
      { currentPassword: 'secret123' },
      { currentPassword: 'secret123', newPassword: 'curta' },
      { newPassword: 'nova123' },
    ])('recusa payload inválido %j', async (body) => {
      const { token } = await register(
        `senha-payload-${Object.keys(body).length}-${body.newPassword ?? 'x'}@example.com`,
      );
      await http()
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(400);
    });
  });

  describe('DELETE /users/me', () => {
    it('exclui a conta logicamente e o login passa a falhar', async () => {
      const { id, token } = await register('exclui@example.com');
      await http()
        .delete('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
      await http()
        .post('/auth/login')
        .send({ email: 'exclui@example.com', password: 'secret123' })
        .expect(401);
      const [row] = await pg
        .query<{
          deleted_at: Date | null;
          status: string;
        }>('SELECT deleted_at, status FROM users WHERE id = $1', [id])
        .then((result) => result.rows);
      expect(row.deleted_at).not.toBeNull();
      expect(row.status).toBe('INACTIVE');
    });
  });

  describe('rotas administrativas', () => {
    let user: { id: string; token: string };

    beforeAll(async () => {
      user = await register('comum@example.com');
    });

    it.each([
      ['get', '/users'],
      ['post', '/users'],
      ['get', '/users/:id'],
      ['patch', '/users/:id'],
      ['delete', '/users/:id'],
    ] as const)('%s %s responde 401 sem token', async (method, path) => {
      await http()[method](path.replace(':id', user.id)).expect(401);
    });

    it.each([
      ['get', '/users'],
      ['post', '/users'],
      ['get', '/users/:id'],
      ['patch', '/users/:id'],
      ['delete', '/users/:id'],
    ] as const)('%s %s responde 403 para USER', async (method, path) => {
      await http()
        [method](path.replace(':id', user.id))
        .set('Authorization', `Bearer ${user.token}`)
        .send({ fullName: 'Hacker' })
        .expect(403);
    });

    it('ADMIN acessa a listagem e o detalhe', async () => {
      const list = await http()
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.map((u: { id: string }) => u.id)).toContain(user.id);
      await http()
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('rotas /me não são capturadas por /:id', async () => {
      const response = await http()
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.email).toBe('admin@example.com');
    });
  });
});
