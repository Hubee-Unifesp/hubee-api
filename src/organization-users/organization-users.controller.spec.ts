import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { DRIZZLE } from '../database/database.constants';
import { OrganizationUsersController } from './organization-users.controller';
import { OrganizationUsersService } from './organization-users.service';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './dto/create-organization-user.dto';
import { OrganizationUserResponseDto } from './dto/organization-user-response.dto';
import { UserInviteResponseDto } from './dto/user-invite-response.dto';

describe('OrganizationUsersController', () => {
  let controller: OrganizationUsersController;
  let service: {
    create: jest.Mock<(orgId: string, dto: any) => Promise<any>>;
    findAll: jest.Mock<(orgId: string) => Promise<any>>;
    findPendingInvitesByUser: jest.Mock<(userId: string) => Promise<any>>;
    respondToInvite: jest.Mock<
      (orgId: string, userId: string, dto: any) => Promise<any>
    >;
    update: jest.Mock<
      (orgId: string, userId: string, dto: any) => Promise<any>
    >;
    remove: jest.Mock<(orgId: string, userId: string) => Promise<any>>;
  };

  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const currentUser: AuthenticatedUser = {
    id: userId,
    email: 'maria@exemplo.com',
    role: 'USER',
  };

  /** Linha enriquecida retornada pelo service (join com users). */
  const row = {
    orgId,
    userId,
    userName: 'Maria Silva',
    userEmail: 'maria@exemplo.com',
    role: OrganizationRole.ADMIN,
    permission: OrganizationPermission.FULL,
    inviteStatus: InviteStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn<(orgId: string, dto: any) => Promise<any>>(),
      findAll: jest.fn<(orgId: string) => Promise<any>>(),
      findPendingInvitesByUser: jest.fn<(userId: string) => Promise<any>>(),
      respondToInvite:
        jest.fn<(orgId: string, userId: string, dto: any) => Promise<any>>(),
      update:
        jest.fn<(orgId: string, userId: string, dto: any) => Promise<any>>(),
      remove: jest.fn<(orgId: string, userId: string) => Promise<any>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [OrganizationUsersController],
      providers: [
        { provide: OrganizationUsersService, useValue: service },
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    controller = module.get<OrganizationUsersController>(
      OrganizationUsersController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() repassa orgId e dto com email pro service', async () => {
    const dto = {
      email: 'maria@exemplo.com',
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    };
    service.create.mockResolvedValueOnce(row);

    const resultado = await controller.create(orgId, dto);

    expect(service.create).toHaveBeenCalledWith(orgId, dto);
    expect(resultado).toBeInstanceOf(OrganizationUserResponseDto);
    expect(resultado).toEqual(row);
  });

  it('findAll() repassa orgId pro service', async () => {
    service.findAll.mockResolvedValueOnce([row]);

    const resultado = await controller.findAll(orgId);

    expect(service.findAll).toHaveBeenCalledWith(orgId);
    expect(resultado[0]).toBeInstanceOf(OrganizationUserResponseDto);
    expect(resultado).toEqual([row]);
  });

  it('findMyInvites() delega para findPendingInvitesByUser() com o user.id autenticado', async () => {
    const inviteRow = {
      orgId,
      organizationName: 'Atlética Unifesp',
      userId,
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.FULL,
      inviteStatus: InviteStatus.PENDING,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    service.findPendingInvitesByUser.mockResolvedValueOnce([inviteRow]);

    const resultado = await controller.findMyInvites(currentUser);

    expect(service.findPendingInvitesByUser).toHaveBeenCalledWith(userId);
    expect(resultado[0]).toBeInstanceOf(UserInviteResponseDto);
    expect(resultado).toEqual([inviteRow]);
  });

  it('respondToInvite() delega orgId, user.id autenticado e decisão pro service', async () => {
    const dto = { inviteStatus: InviteStatus.ACCEPTED };
    const atualizado = { ...row, inviteStatus: InviteStatus.ACCEPTED };
    service.respondToInvite.mockResolvedValueOnce(atualizado);

    const resultado = await controller.respondToInvite(orgId, currentUser, dto);

    expect(service.respondToInvite).toHaveBeenCalledWith(orgId, userId, dto);
    expect(resultado).toBeInstanceOf(OrganizationUserResponseDto);
    expect(resultado).toEqual(atualizado);
  });

  it('update() repassa orgId, userId e dto pro service', async () => {
    const dto = { inviteStatus: InviteStatus.ACCEPTED };
    const atualizado = { ...row, ...dto };
    service.update.mockResolvedValueOnce(atualizado);

    const resultado = await controller.update(orgId, userId, dto);

    expect(service.update).toHaveBeenCalledWith(orgId, userId, dto);
    expect(resultado).toBeInstanceOf(OrganizationUserResponseDto);
    expect(resultado).toEqual(atualizado);
  });

  it('remove() repassa orgId e userId pro service', async () => {
    service.remove.mockResolvedValueOnce(undefined);

    const resultado = await controller.remove(orgId, userId);

    expect(service.remove).toHaveBeenCalledWith(orgId, userId);
    expect(resultado).toBeUndefined();
  });
});
