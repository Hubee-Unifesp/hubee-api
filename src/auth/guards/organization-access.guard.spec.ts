import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgAccess } from '../decorators/org-access.decorator';
import { OrgAccessLevel, ORG_ACCESS_KEY } from '../org-access-level';
import { OrganizationAccessGuard } from './organization-access.guard';

const ORG_ID = '3f1a6f1e-0b6a-4d4a-9c2e-8e4a1d5b9c77';
const EVENT_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const USER = { id: 'user-id', email: 'user@example.com', role: 'USER' };

type Membership = {
  role: string;
  permission: string;
  inviteStatus: string;
};

const member = (overrides: Partial<Membership> = {}): Membership => ({
  role: 'member',
  permission: 'read_only',
  inviteStatus: 'accepted',
  ...overrides,
});

class Routes {
  @OrgAccess('read')
  byOrgDefault() {}

  @OrgAccess('write')
  write() {}

  @OrgAccess('manage')
  manage() {}

  @OrgAccess('read', { from: 'org', param: 'id' })
  byOrgCustomParam() {}

  @OrgAccess('read', { from: 'event', param: 'eventId' })
  byEvent() {}

  @OrgAccess('write', { from: 'body', field: 'organizerId' })
  byBody() {}

  open() {}
}

/**
 * Cada `select().from().where()` consome o próximo resultado da fila. O guard
 * só consulta o evento (quando a origem é `event`) e depois o vínculo.
 */
function fakeDb(...results: unknown[][]) {
  const queue = [...results];
  const where = jest.fn(() => Promise.resolve(queue.shift() ?? []));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  return { db: { select } as never, select, where };
}

function contextFor(
  handler: (...args: never[]) => void,
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

function guardWith(...results: unknown[][]) {
  const { db, select } = fakeDb(...results);
  return { guard: new OrganizationAccessGuard(new Reflector(), db), select };
}

const orgRequest = (user: unknown = USER) => ({
  user,
  params: { orgId: ORG_ID },
});

describe('OrganizationAccessGuard', () => {
  describe('quando libera sem consultar o banco', () => {
    it('rota sem @OrgAccess', async () => {
      const { guard, select } = guardWith();
      await expect(
        guard.canActivate(contextFor(Routes.prototype.open, {})),
      ).resolves.toBe(true);
      expect(select).not.toHaveBeenCalled();
    });

    it('ADMIN global, mesmo sem vínculo', async () => {
      const { guard, select } = guardWith();
      const request = orgRequest({ ...USER, role: 'ADMIN' });
      await expect(
        guard.canActivate(contextFor(Routes.prototype.manage, request)),
      ).resolves.toBe(true);
      expect(select).not.toHaveBeenCalled();
    });
  });

  it('recusa com 401 quando não há usuário autenticado', async () => {
    const { guard } = guardWith();
    await expect(
      guard.canActivate(
        contextFor(Routes.prototype.byOrgDefault, {
          params: { orgId: ORG_ID },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('níveis de acesso', () => {
    const cases: {
      name: string;
      route: keyof Routes;
      membership: Membership | undefined;
      allowed: boolean;
    }[] = [
      {
        name: 'write: admin + full',
        route: 'write',
        membership: member({ role: 'admin', permission: 'full' }),
        allowed: true,
      },
      {
        name: 'write: member + full',
        route: 'write',
        membership: member({ permission: 'full' }),
        allowed: true,
      },
      {
        name: 'write: member + read_only',
        route: 'write',
        membership: member(),
        allowed: false,
      },
      {
        name: 'write: admin implica write mesmo com read_only',
        route: 'write',
        membership: member({ role: 'admin' }),
        allowed: true,
      },
      {
        name: 'manage: admin',
        route: 'manage',
        membership: member({ role: 'admin', permission: 'full' }),
        allowed: true,
      },
      {
        name: 'manage: member + full',
        route: 'manage',
        membership: member({ permission: 'full' }),
        allowed: false,
      },
      {
        name: 'read: member + read_only',
        route: 'byOrgDefault',
        membership: member(),
        allowed: true,
      },
      {
        name: 'read: member + full',
        route: 'byOrgDefault',
        membership: member({ permission: 'full' }),
        allowed: true,
      },
      {
        name: 'sem vínculo',
        route: 'byOrgDefault',
        membership: undefined,
        allowed: false,
      },
      {
        name: 'convite pending, mesmo com admin + full',
        route: 'byOrgDefault',
        membership: member({
          role: 'admin',
          permission: 'full',
          inviteStatus: 'pending',
        }),
        allowed: false,
      },
      {
        name: 'convite rejected, mesmo com admin + full',
        route: 'byOrgDefault',
        membership: member({
          role: 'admin',
          permission: 'full',
          inviteStatus: 'rejected',
        }),
        allowed: false,
      },
    ];

    it.each(cases)('$name', async ({ route, membership, allowed }) => {
      const { guard } = guardWith(membership ? [membership] : []);
      const result = guard.canActivate(
        contextFor(Routes.prototype[route], orgRequest()),
      );
      if (allowed) await expect(result).resolves.toBe(true);
      else await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('origem da organização', () => {
    it('usa o param `orgId` por padrão', async () => {
      const { guard, select } = guardWith([member()]);
      await expect(
        guard.canActivate(
          contextFor(Routes.prototype.byOrgDefault, orgRequest()),
        ),
      ).resolves.toBe(true);
      expect(select).toHaveBeenCalledTimes(1);
    });

    it('aceita outro nome de param da rota', async () => {
      const { guard } = guardWith([member()]);
      await expect(
        guard.canActivate(
          contextFor(Routes.prototype.byOrgCustomParam, {
            user: USER,
            params: { id: ORG_ID },
          }),
        ),
      ).resolves.toBe(true);
    });

    it('resolve a organização do evento e depois consulta o vínculo', async () => {
      const { guard, select } = guardWith(
        [{ organizerId: ORG_ID }],
        [member()],
      );
      await expect(
        guard.canActivate(
          contextFor(Routes.prototype.byEvent, {
            user: USER,
            params: { eventId: EVENT_ID },
          }),
        ),
      ).resolves.toBe(true);
      expect(select).toHaveBeenCalledTimes(2);
    });

    it('evento inexistente responde 404', async () => {
      const { guard } = guardWith([]);
      await expect(
        guard.canActivate(
          contextFor(Routes.prototype.byEvent, {
            user: USER,
            params: { eventId: EVENT_ID },
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lê a organização do body', async () => {
      const { guard } = guardWith([member({ permission: 'full' })]);
      await expect(
        guard.canActivate(
          contextFor(Routes.prototype.byBody, {
            user: USER,
            params: {},
            body: { organizerId: ORG_ID },
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([
      ['param ausente', { user: USER, params: {} }],
      ['param inválido', { user: USER, params: { orgId: 'abc' } }],
      ['body ausente', { user: USER, params: {}, body: undefined }],
    ])('%s responde 400 sem consultar o banco', async (_name, request) => {
      const { guard, select } = guardWith();
      const handler = _name.startsWith('body')
        ? Routes.prototype.byBody
        : Routes.prototype.byOrgDefault;
      await expect(
        guard.canActivate(contextFor(handler, request)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(select).not.toHaveBeenCalled();
    });

    it('organizerId inválido no body responde 400', async () => {
      const { guard } = guardWith();
      await expect(
        guard.canActivate(
          contextFor(Routes.prototype.byBody, {
            user: USER,
            params: {},
            body: { organizerId: 'abc' },
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('@OrgAccess', () => {
  const reflector = new Reflector();
  const metadataOf = (handler: (...args: never[]) => void) =>
    reflector.get(ORG_ACCESS_KEY, handler);

  it('grava o nível e, sem opções, usa o param `orgId`', () => {
    expect(metadataOf(Routes.prototype.manage)).toEqual({
      level: 'manage' satisfies OrgAccessLevel,
      source: { from: 'org' },
    });
  });

  it('grava a origem informada', () => {
    expect(metadataOf(Routes.prototype.byBody)).toEqual({
      level: 'write',
      source: { from: 'body', field: 'organizerId' },
    });
  });

  it('aplica JwtAuthGuard antes do OrganizationAccessGuard', () => {
    const guards = Reflect.getMetadata('__guards__', Routes.prototype.write);
    expect(guards.map((guard: { name: string }) => guard.name)).toEqual([
      'JwtAuthGuard',
      'OrganizationAccessGuard',
    ]);
  });
});
