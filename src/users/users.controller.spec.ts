import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

type AnyAsyncFn = (...args: any[]) => Promise<any>;

describe('UsersController', () => {
  let controller: UsersController;

  const currentUser: AuthenticatedUser = {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    email: 'maria@example.com',
    role: 'USER',
  };

  const mockUsersService = {
    create: jest.fn<AnyAsyncFn>(),
    findAll: jest.fn<AnyAsyncFn>(),
    findOne: jest.fn<AnyAsyncFn>(),
    update: jest.fn<AnyAsyncFn>(),
    remove: jest.fn<AnyAsyncFn>(),
    updateMe: jest.fn<AnyAsyncFn>(),
    changePassword: jest.fn<AnyAsyncFn>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('rotas /me', () => {
    it('updateMe usa o id do token e devolve o usuário atualizado', async () => {
      const updated = { id: currentUser.id, fullName: 'Maria Nova' };
      mockUsersService.updateMe.mockResolvedValue(updated);

      const result = await controller.updateMe(currentUser, {
        fullName: 'Maria Nova',
      });

      expect(mockUsersService.updateMe).toHaveBeenCalledWith(currentUser.id, {
        fullName: 'Maria Nova',
      });
      expect(result).toBe(updated);
    });

    it('changePassword repassa id, senha atual e nova senha', async () => {
      mockUsersService.changePassword.mockResolvedValue(undefined);

      await controller.changePassword(currentUser, {
        currentPassword: 'antiga123',
        newPassword: 'nova12345',
      });

      expect(mockUsersService.changePassword).toHaveBeenCalledWith(
        currentUser.id,
        'antiga123',
        'nova12345',
      );
    });

    it('removeMe exclui o usuário do token', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      await controller.removeMe(currentUser);

      expect(mockUsersService.remove).toHaveBeenCalledWith(currentUser.id);
    });

    it.each(['updateMe', 'changePassword', 'removeMe'] as const)(
      '%s não exige role específica',
      (method) => {
        expect(
          Reflect.getMetadata(ROLES_KEY, UsersController.prototype[method]),
        ).toBeUndefined();
      },
    );
  });

  describe('rotas administrativas', () => {
    it.each(['create', 'findAll', 'findOne', 'update', 'remove'] as const)(
      '%s exige @Roles(ADMIN)',
      (method) => {
        expect(
          Reflect.getMetadata(ROLES_KEY, UsersController.prototype[method]),
        ).toEqual(['ADMIN']);
      },
    );

    it('findAll delega ao service', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      await expect(controller.findAll()).resolves.toEqual([]);
      expect(mockUsersService.findAll).toHaveBeenCalled();
    });

    it('update delega ao service com o id da URL', async () => {
      const id = 'a1b2c3d4-0000-4000-8000-000000000002';
      mockUsersService.update.mockResolvedValue({ id });

      await controller.update(id, { fullName: 'Outro' });

      expect(mockUsersService.update).toHaveBeenCalledWith(id, {
        fullName: 'Outro',
      });
    });
  });
});
