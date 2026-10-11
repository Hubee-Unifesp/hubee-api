import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('UsersController', () => {
  let controller: UsersController;
  const user: AuthenticatedUser = {
    id: 'user-id',
    email: 'user@example.com',
    role: 'USER',
  };

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findMe: jest.fn(),
    update: jest.fn(),
    updateMe: jest.fn(),
    changePassword: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('deve estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('rotas /me usam o id do usuário autenticado', async () => {
    const body = { fullName: 'Novo Nome' };
    const passwords = { currentPassword: 'old123', newPassword: 'new123' };

    await controller.findMe(user);
    await controller.updateMe(user, body);
    await controller.changePassword(user, passwords);
    await controller.removeMe(user);

    expect(mockUsersService.findMe).toHaveBeenCalledWith('user-id');
    expect(mockUsersService.updateMe).toHaveBeenCalledWith('user-id', body);
    expect(mockUsersService.changePassword).toHaveBeenCalledWith(
      'user-id',
      passwords,
    );
    expect(mockUsersService.remove).toHaveBeenCalledWith('user-id');
  });

  it('declara as rotas /me antes das rotas /:id', () => {
    const methods = Object.getOwnPropertyNames(UsersController.prototype);
    const lastMe = Math.max(
      ...['findMe', 'updateMe', 'changePassword', 'removeMe'].map((name) =>
        methods.indexOf(name),
      ),
    );
    const firstById = Math.min(
      ...['findOne', 'update', 'remove'].map((name) => methods.indexOf(name)),
    );
    expect(lastMe).toBeLessThan(firstById);
  });
});
