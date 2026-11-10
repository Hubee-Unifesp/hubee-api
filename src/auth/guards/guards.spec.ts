import { describe, expect, it, jest } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { OrganizerGuard } from './organizer.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UsersService } from '../../users/users.service';

class RestrictedController {
  @Roles('ADMIN')
  admin() {}
  open() {}
}

function context(
  request: any,
  handler = RestrictedController.prototype.open,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => RestrictedController,
  } as unknown as ExecutionContext;
}

const jwt = new JwtService({ secret: 'guard-test-secret' });
const guard = new JwtAuthGuard(jwt);

describe('JwtAuthGuard', () => {
  it.each([
    undefined,
    '',
    'Basic abc',
    'Bearer',
    'Bearer a b',
    'Bearer invalid',
  ])('recusa Authorization=%j', async (authorization) => {
    await expect(
      guard.canActivate(context({ headers: { authorization } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifica JWT e coloca apenas id, email e role no request', async () => {
    const token = await jwt.signAsync({
      sub: 'user-id',
      email: 'user@example.com',
      role: 'ADMIN',
      extra: 'private',
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      user: undefined,
    };
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(req.user).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      role: 'ADMIN',
    });
  });

  it('recusa token expirado e assinatura incorreta', async () => {
    const expired = await jwt.signAsync(
      { sub: 'id', email: 'user@example.com', role: 'USER' },
      { expiresIn: -1 },
    );
    const wrongSecret = await new JwtService({ secret: 'other' }).signAsync({
      sub: 'id',
      email: 'user@example.com',
      role: 'USER',
    });
    for (const token of [expired, wrongSecret]) {
      await expect(
        guard.canActivate(
          context({ headers: { authorization: `Bearer ${token}` } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it.each([
    { email: 'a@b.com', role: 'USER' },
    { sub: 'id', role: 'USER' },
    { sub: 'id', email: 'a@b.com', role: 'ORGANIZE' },
  ])('recusa claims inválidas %j', async (payload) => {
    const token = await jwt.signAsync(payload);
    await expect(
      guard.canActivate(
        context({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('consulta o UsersService quando disponível e sincroniza role/email do banco', async () => {
    const findActiveUser = jest.fn(async (_id: string) => ({
      id: 'user-id',
      email: 'atualizado@example.com',
      role: 'ADMIN' as const,
      status: 'ACTIVE',
      deletedAt: null,
    }));
    const guardWithUsers = new JwtAuthGuard(jwt, {
      findActiveUser,
    } as unknown as UsersService);

    const token = await jwt.signAsync({
      sub: 'user-id',
      email: 'antigo@example.com',
      role: 'USER',
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      user: undefined,
    };

    await expect(guardWithUsers.canActivate(context(req))).resolves.toBe(true);
    expect(findActiveUser).toHaveBeenCalledWith('user-id');
    expect(req.user).toEqual({
      id: 'user-id',
      email: 'atualizado@example.com',
      role: 'ADMIN',
    });
  });

  it('recusa com 401 quando a conta está excluída, inativa ou não existe no UsersService', async () => {
    const findActiveUser = jest.fn(async (_id: string) => null);
    const guardWithUsers = new JwtAuthGuard(jwt, {
      findActiveUser,
    } as unknown as UsersService);

    const token = await jwt.signAsync({
      sub: 'deleted-user-id',
      email: 'deleted@example.com',
      role: 'USER',
    });

    await expect(
      guardWithUsers.canActivate(
        context({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toThrow(
      new UnauthorizedException('Usuário inativo ou não encontrado'),
    );
    expect(findActiveUser).toHaveBeenCalledWith('deleted-user-id');
  });
});

describe('OptionalJwtAuthGuard', () => {
  const optionalGuard = new OptionalJwtAuthGuard(jwt);

  it('deixa passar sem Authorization e sem preencher o usuário', async () => {
    const req = { headers: {}, user: undefined };
    await expect(optionalGuard.canActivate(context(req))).resolves.toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('preenche o usuário quando o token é válido', async () => {
    const token = await jwt.signAsync({
      sub: 'user-id',
      email: 'user@example.com',
      role: 'USER',
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      user: undefined,
    };
    await expect(optionalGuard.canActivate(context(req))).resolves.toBe(true);
    expect(req.user).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      role: 'USER',
    });
  });

  it.each(['', 'Bearer invalid'])(
    'recusa Authorization=%j enviado mas inválido',
    async (authorization) => {
      await expect(
        optionalGuard.canActivate(context({ headers: { authorization } })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('recusa com 401 se o token enviado pertencer a usuário inativo ou excluído', async () => {
    const optionalWithUsers = new OptionalJwtAuthGuard(jwt, {
      findActiveUser: jest.fn(async () => null),
    } as unknown as UsersService);
    const token = await jwt.signAsync({
      sub: 'deleted-id',
      email: 'deleted@example.com',
      role: 'USER',
    });

    await expect(
      optionalWithUsers.canActivate(
        context({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('RolesGuard e @Roles', () => {
  const rolesGuard = new RolesGuard(new Reflector());

  it('permite rota sem restrição', () => {
    expect(rolesGuard.canActivate(context({}))).toBe(true);
  });

  it('permite ADMIN e recusa USER e usuário ausente em @Roles ADMIN', () => {
    const handler = RestrictedController.prototype.admin;
    expect(
      rolesGuard.canActivate(context({ user: { role: 'ADMIN' } }, handler)),
    ).toBe(true);
    for (const user of [undefined, { role: 'USER' }]) {
      expect(() => rolesGuard.canActivate(context({ user }, handler))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('respeita metadados no controller', () => {
    @Roles('ADMIN')
    class AdminController {}
    const ctx = context({ user: { role: 'USER' } });
    ctx.getClass = (() => AdminController) as typeof ctx.getClass;
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

describe('OrganizerGuard', () => {
  const makeGuard = (rows: unknown[]) =>
    new OrganizerGuard({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({ orderBy: async () => rows }),
          }),
        }),
      }),
    } as never);

  it('lança UnauthorizedException sem usuário no request', async () => {
    const organizerGuard = makeGuard([]);
    await expect(organizerGuard.canActivate(context({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('permite ADMIN global sem consultar organizações', async () => {
    const organizerGuard = makeGuard([]);
    await expect(
      organizerGuard.canActivate(
        context({ user: { id: 'adm-1', email: 'a@b.com', role: 'ADMIN' } }),
      ),
    ).resolves.toBe(true);
  });

  it('permite USER com vínculo aceito em pelo menos uma organização', async () => {
    const organizerGuard = makeGuard([
      {
        orgId: 'org-1',
        organizationName: 'Produtora',
        role: 'member',
        permission: 'read_only',
        inviteStatus: 'accepted',
      },
    ]);
    await expect(
      organizerGuard.canActivate(
        context({ user: { id: 'usr-1', email: 'u@b.com', role: 'USER' } }),
      ),
    ).resolves.toBe(true);
  });

  it('lança ForbiddenException para USER sem organização ativa', async () => {
    const organizerGuard = makeGuard([]);
    await expect(
      organizerGuard.canActivate(
        context({ user: { id: 'usr-1', email: 'u@b.com', role: 'USER' } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
