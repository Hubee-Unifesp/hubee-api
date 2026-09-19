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
 * ajuste os campos para o que organizations e usuarios realmente exigem.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import * as schema from '../database/schema';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './dto/create-organizacao-usuario.dto';

describe('OrganizacaoUsuariosService (banco real)', () => {
  let db: any;
  let pglite: PGlite;
  let service: OrganizacaoUsuariosService;

  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    pglite = new PGlite();
    db = drizzle(pglite, { schema });

    const { apply } = await pushSchema(schema as any, db);
    await apply();

    service = new OrganizacaoUsuariosService(
      db,
      // As dependências só fazem validação de existência; aqui as linhas
      // realmente existem no banco, então um stub que resolve basta.
      { findOne: async () => ({}) } as any,
      { findOne: async () => ({}) } as any,
    );
  });

  afterAll(async () => {
    await pglite.close();
  });

  beforeEach(async () => {
    await db.delete(schema.organizationUsers);
    await db.delete(schema.organizations);
    await db.delete(schema.usuarios);

    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Organização de Teste',
        description: 'Uma organização para testes de integração',
      })
      .returning();
    orgId = org.id;

    const [user] = await db
      .insert(schema.usuarios)
      .values({
        firstName: 'Usuário',
        lastName: 'Teste',
        email: `teste-${Date.now()}@exemplo.com`,
        password: 'hashed_password_123', // Em produção seria hash real
        cpf: `${Date.now().toString().slice(-11)}`,
        birthDate: new Date('1990-01-01'),
        profileType: 'MEMBER',
      })
      .returning();
    userId = user.id;
  });

  const lerVinculo = async () => {
    const [linha] = await db
      .select()
      .from(schema.organizationUsers)
      .where(eq(schema.organizationUsers.userId, userId));
    return linha;
  };

  it('create persiste role e permission, e aplica o default de inviteStatus', async () => {
    const retorno = await service.create(orgId, {
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    expect(retorno).toMatchObject({
      orgId,
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.PENDING,
    });

    // Confere o que ficou gravado, não só o que o .returning() devolveu
    await expect(lerVinculo()).resolves.toMatchObject({
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.PENDING,
    });
  });

  it('update persiste inviteStatus sem apagar role e permission', async () => {
    await service.create(orgId, {
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    await service.update(orgId, userId, {
      inviteStatus: InviteStatus.ACCEPTED,
    });

    await expect(lerVinculo()).resolves.toMatchObject({
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.ACCEPTED,
    });
  });

  it('update persiste role e permission', async () => {
    await service.create(orgId, {
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    await service.update(orgId, userId, {
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.READ_ONLY,
    });

    await expect(lerVinculo()).resolves.toMatchObject({
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.READ_ONLY,
    });
  });

  it('update atualiza updatedAt', async () => {
    await service.create(orgId, {
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });
    const antes = await lerVinculo();

    await new Promise((r) => setTimeout(r, 10));
    await service.update(orgId, userId, { role: OrganizationRole.MEMBER });
    const depois = await lerVinculo();

    expect(new Date(depois.updatedAt).getTime()).toBeGreaterThan(
      new Date(antes.updatedAt).getTime(),
    );
  });

  it('remove apaga a linha', async () => {
    await service.create(orgId, {
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    });

    await service.remove(orgId, userId);

    await expect(lerVinculo()).resolves.toBeUndefined();
  });
});