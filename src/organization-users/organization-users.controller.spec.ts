import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationUsersController } from './organization-users.controller';
import { OrganizationUsersService } from './organization-users.service';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from './dto/create-organization-user.dto';

describe('OrganizationUsersController', () => {
  let controller: OrganizationUsersController;
  let service: {
    create: jest.Mock<(orgId: string, dto: any) => Promise<any>>;
    findAll: jest.Mock<(orgId: string) => Promise<any>>;
    update: jest.Mock<
      (orgId: string, userId: string, dto: any) => Promise<any>
    >;
    remove: jest.Mock<(orgId: string, userId: string) => Promise<any>>;
  };

  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    service = {
      create: jest.fn<(orgId: string, dto: any) => Promise<any>>(),
      findAll: jest.fn<(orgId: string) => Promise<any>>(),
      update:
        jest.fn<(orgId: string, userId: string, dto: any) => Promise<any>>(),
      remove: jest.fn<(orgId: string, userId: string) => Promise<any>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationUsersController],
      providers: [{ provide: OrganizationUsersService, useValue: service }],
    }).compile();

    controller = module.get<OrganizationUsersController>(
      OrganizationUsersController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() repassa orgId e dto pro service', async () => {
    const dto = {
      userId,
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    };
    const respostaFalsa = { orgId, ...dto };
    service.create.mockResolvedValueOnce(respostaFalsa);

    const resultado = await controller.create(orgId, dto);

    expect(service.create).toHaveBeenCalledWith(orgId, dto);
    expect(resultado).toEqual(respostaFalsa);
  });

  it('findAll() repassa orgId pro service', async () => {
    const listaFalsa = [{ orgId, userId }];
    service.findAll.mockResolvedValueOnce(listaFalsa);

    const resultado = await controller.findAll(orgId);

    expect(service.findAll).toHaveBeenCalledWith(orgId);
    expect(resultado).toEqual(listaFalsa);
  });

  it('update() repassa orgId, userId e dto pro service', async () => {
    const dto = { inviteStatus: InviteStatus.ACCEPTED };
    const respostaFalsa = { orgId, userId, ...dto };
    service.update.mockResolvedValueOnce(respostaFalsa);

    const resultado = await controller.update(orgId, userId, dto);

    expect(service.update).toHaveBeenCalledWith(orgId, userId, dto);
    expect(resultado).toEqual(respostaFalsa);
  });

  it('remove() repassa orgId e userId pro service', async () => {
    service.remove.mockResolvedValueOnce(undefined);

    const resultado = await controller.remove(orgId, userId);

    expect(service.remove).toHaveBeenCalledWith(orgId, userId);
    expect(resultado).toBeUndefined();
  });
});
