import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { OrderService } from '../order/order.service';
import { OrderResponseDto } from '../order/dto/order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { MeResponseDto, UserResponseDto } from './dto/user-response.dto';

/** Linha completa do banco, incluindo os campos internos. */
const row = {
  id: 'user-id',
  fullName: 'Pessoa Teste',
  email: 'user@example.com',
  phone: null,
  password: '$2b$10$hash',
  cpf: '52998224725',
  birthDate: '1990-05-20',
  role: 'USER' as const,
  signupIntent: 'BUY' as const,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};
const { password: _password, deletedAt: _deletedAt, ...publicUser } = row;

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
    removeMe: jest.fn(),
  };

  const mockOrderService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: OrderService, useValue: mockOrderService },
      ],
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

  it('GET /me/orders filtra pelo usuário do token, ignorando o userId da query', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-id',
      totalAmount: 150.5,
      status: 'pendente',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    mockOrderService.findAll.mockResolvedValue([order] as never);

    const result = await controller.getMyOrders(user, {
      userId: 'outro-usuario',
      status: 'pendente',
    });

    expect(mockOrderService.findAll).toHaveBeenCalledWith({
      userId: 'user-id',
      status: 'pendente',
    });
    expect(result).toEqual([expect.any(OrderResponseDto)]);
  });

  describe('resposta segue o UserResponseDto (sem password/deletedAt)', () => {
    it.each([
      ['create', () => controller.create(row as never)],
      ['findOne', () => controller.findOne('user-id')],
      ['update', () => controller.update('user-id', {})],
    ] as const)('%s', async (method, call) => {
      mockUsersService[method].mockResolvedValue(row as never);

      const result = await call();

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result).toEqual(publicUser);
    });

    it('findAll', async () => {
      mockUsersService.findAll.mockResolvedValue([row] as never);

      const result = await controller.findAll();

      expect(result[0]).toBeInstanceOf(UserResponseDto);
      expect(result).toEqual([publicUser]);
    });

    it.each([
      ['findMe', () => controller.findMe(user)],
      ['updateMe', () => controller.updateMe(user, {})],
    ] as const)('%s inclui profileComplete', async (method, call) => {
      mockUsersService[method].mockResolvedValue({
        ...row,
        profileComplete: true,
      } as never);

      const result = await call();

      expect(result).toBeInstanceOf(MeResponseDto);
      expect(result).toEqual({ ...publicUser, profileComplete: true });
    });
  });

  it('declara as rotas /me antes das rotas /:id', () => {
    const methods = Object.getOwnPropertyNames(UsersController.prototype);
    const lastMe = Math.max(
      ...[
        'findMe',
        'updateMe',
        'changePassword',
        'removeMe',
        'getMyOrders',
      ].map((name) => methods.indexOf(name)),
    );
    const firstById = Math.min(
      ...['findOne', 'update', 'remove'].map((name) => methods.indexOf(name)),
    );
    expect(lastMe).toBeLessThan(firstById);
  });
});
