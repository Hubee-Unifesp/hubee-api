import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

describe('Auth endpoints (Postgres em memória)', () => {
  let app: INestApplication;
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;
  let users: UsersService;
  let jwt: JwtService;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(
      readFileSync(
        'src/database/migrations/0000_lyrical_spencer_smythe.sql',
        'utf8',
      ),
    );
    await pg.exec(
      `INSERT INTO users (first_name, last_name, email, password, profile_type) VALUES ('Legacy', 'Admin', 'legacy@example.com', 'hash', 'ADMIN')`,
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
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        JwtAuthGuard,
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
  });

  afterAll(async () => {
    await app?.close();
    await pg?.close();
  });

  it('migration preserva nome, ADMIN e índices únicos parciais', async () => {
    const legacy = await users.findByEmail('legacy@example.com');
    expect(legacy).toMatchObject({
      fullName: 'Legacy Admin',
      role: 'ADMIN',
      cpf: null,
      birthDate: null,
    });
    const indexes = await pg.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'users'",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining(['users_email_unique', 'users_cpf_unique']),
    );
  });

  it('register cria USER sem CPF e nascimento, normaliza e-mail e retorna JWT sem senha', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: ' Maria Silva ',
        email: ' MARIA@Example.COM ',
        password: 'secret123',
        signupIntent: 'ORGANIZE',
      })
      .expect(201);
    expect(response.body.user).toMatchObject({
      fullName: 'Maria Silva',
      email: 'maria@example.com',
      role: 'USER',
      signupIntent: 'ORGANIZE',
      cpf: null,
      birthDate: null,
    });
    expect(response.body.user).not.toHaveProperty('password');
    token = response.body.access_token;
    userId = response.body.user.id;
    expect(await jwt.verifyAsync(token)).toMatchObject({
      sub: userId,
      email: 'maria@example.com',
      role: 'USER',
    });
    expect((await users.findByEmail('maria@example.com')).password).not.toBe(
      'secret123',
    );
  });

  it('register aceita intenção omitida e múltiplos CPFs NULL', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'João Silva',
        email: 'joao@example.com',
        password: 'secret123',
      })
      .expect(201);
    expect(response.body.user).toMatchObject({
      role: 'USER',
      signupIntent: null,
      cpf: null,
    });
  });

  it('register recusa e-mail duplicado após normalização', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Maria',
        email: ' MARIA@EXAMPLE.COM ',
        password: 'secret123',
      })
      .expect(409);
  });

  it.each([
    { role: 'ADMIN' },
    { signupIntent: 'ADMIN' },
    { fullName: ' ' },
    { fullName: 'x'.repeat(201) },
    { email: 42 },
    { password: 'short' },
  ])('register rejeita payload inválido %j', async (override) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Teste',
        email: 'invalid@example.com',
        password: 'secret123',
        ...override,
      })
      .expect(400);
  });

  it('me exige token e retorna usuário sem senha com perfil incompleto', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: userId,
      role: 'USER',
      profileComplete: false,
    });
    expect(response.body).not.toHaveProperty('password');
  });

  it('me calcula profileComplete apenas quando CPF e nascimento existem', async () => {
    await users.update(userId, { cpf: '12345678901' });
    const partial = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(partial.body.profileComplete).toBe(false);
    await users.update(userId, { birthDate: '1990-01-01' });
    const complete = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(complete.body.profileComplete).toBe(true);
  });

  it('edição normaliza e-mail e login aceita maiúsculas e espaços', async () => {
    await users.update(userId, { email: ' NEW@Example.COM ' });
    expect(await users.findOne(userId)).toMatchObject({
      email: 'new@example.com',
    });
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ' NEW@EXAMPLE.COM ', password: 'secret123' })
      .expect(200);
    expect(await jwt.verifyAsync(response.body.access_token)).toMatchObject({
      sub: userId,
      email: 'new@example.com',
      role: 'USER',
    });
    await expect(
      users.update(userId, { email: ' JOAO@EXAMPLE.COM ' }),
    ).rejects.toThrow('E-mail ou CPF já cadastrados.');
  });

  it('login recusa senha incorreta e usuário inexistente', async () => {
    for (const [email, password] of [
      ['new@example.com', 'wrong'],
      ['missing@example.com', 'secret123'],
    ]) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(401);
    }
  });

  it.each(['INACTIVE', 'BLOCKED', null])(
    'login recusa status %j',
    async (status) => {
      await db
        .update(schema.users)
        .set({ status })
        .where(eq(schema.users.id, userId));
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'new@example.com', password: 'secret123' })
        .expect(401);
    },
  );
});
