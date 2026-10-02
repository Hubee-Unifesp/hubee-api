import { describe, expect, it } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from '../decorators/roles.decorator';

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
    ctx.getClass = () => AdminController;
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
