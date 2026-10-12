import { jest } from '@jest/globals';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { orders } from '../database/schema';
import { UsersService } from '../users/users.service';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

type Order = typeof orders.$inferSelect;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    userId: 'user-1',
    status: 'pendente',
    totalAmount: 150.5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: {
    findAll: jest.Mock<OrderRepository['findAll']>;
    findById: jest.Mock<OrderRepository['findById']>;
    create: jest.Mock<OrderRepository['create']>;
    update: jest.Mock<OrderRepository['update']>;
  };
  let usersService: {
    findOne: jest.Mock<UsersService['findOne']>;
  };

  const mockAuthUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'teste@exemplo.com',
    role: 'USER',
  };

  const mockAdmin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@exemplo.com',
    role: 'ADMIN',
  };

  beforeEach(async () => {
    orderRepository = {
      findAll: jest.fn<OrderRepository['findAll']>(),
      findById: jest.fn<OrderRepository['findById']>(),
      create: jest.fn<OrderRepository['create']>(),
      update: jest.fn<OrderRepository['update']>(),
    };
    usersService = {
      findOne: jest.fn<UsersService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: orderRepository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(OrderService);
  });

  describe('findAll()', () => {
    it('repassa os filtros de usuário e status para o repositório', async () => {
      const rows = [makeOrder()];
      orderRepository.findAll.mockResolvedValue(rows);

      const result = await service.findAll({
        userId: 'user-1',
        status: 'pendente',
      });

      expect(orderRepository.findAll).toHaveBeenCalledWith({
        userId: 'user-1',
        status: 'pendente',
      });
      expect(result).toEqual(rows);
    });

    it('repassa o filtro de usuário vindo dentro dos filtros sem apagá-lo', async () => {
      orderRepository.findAll.mockResolvedValue([]);

      await service.findAll({ userId: 'user-1' });

      expect(orderRepository.findAll).toHaveBeenCalledWith({
        userId: 'user-1',
      });
    });
  });

  describe('findOne()', () => {
    it('retorna o pedido quando ele existe', async () => {
      const order = makeOrder();
      orderRepository.findById.mockResolvedValue(order);

      await expect(service.findOne('order-1', mockAuthUser)).resolves.toEqual(
        order,
      );
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.findOne('order-1', mockAuthUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('responde NotFound quando o pedido é de outro usuário', async () => {
      orderRepository.findById.mockResolvedValue(
        makeOrder({ userId: 'outro-usuario' }),
      );

      await expect(
        service.findOne('order-1', mockAuthUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create()', () => {
    it('cria o pedido depois de confirmar que o comprador tem perfil completo', async () => {
      const created = makeOrder();
      // Simulando usuário com perfil completo
      usersService.findOne.mockResolvedValue({
        id: 'user-1',
        cpf: '123',
        birthDate: new Date(),
      } as any);
      orderRepository.create.mockResolvedValue(created);

      const result = await service.create(mockAuthUser, { totalAmount: 150.5 });

      expect(usersService.findOne).toHaveBeenCalledWith('user-1');
      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        totalAmount: 150.5,
      });
      expect(result).toEqual(created);
    });

    it('recusa criar pedido se perfil estiver incompleto', async () => {
      // Simulando usuário SEM cpf e birthDate
      usersService.findOne.mockResolvedValue({ id: 'user-1' } as any);

      await expect(
        service.create(mockAuthUser, { totalAmount: 150.5 }),
      ).rejects.toMatchObject({
        response: {
          statusCode: 403,
          error: 'Forbidden',
          code: 'PROFILE_INCOMPLETE',
          missing: ['cpf', 'birthDate'],
        },
      });
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound e não cria quando o comprador não existe', async () => {
      usersService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.create(mockAuthUser, { totalAmount: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('recusa com 403 quando quem altera não é ADMIN', async () => {
      orderRepository.findById.mockResolvedValue(makeOrder());

      await expect(
        service.update('order-1', { totalAmount: 0 }, mockAuthUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('atualiza o status de um pedido pendente', async () => {
      const updated = makeOrder({ status: 'pago' });
      orderRepository.findById.mockResolvedValue(makeOrder());
      orderRepository.update.mockResolvedValue(updated);

      const result = await service.update(
        'order-1',
        { status: 'pago' },
        mockAdmin,
      );

      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: 'pago',
      });
      expect(result).toEqual(updated);
    });

    it('lança NotFound e não escreve quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('order-1', { status: 'pago' }, mockAdmin),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('recusa alteração de pedido cancelado com 422', async () => {
      orderRepository.findById.mockResolvedValue(
        makeOrder({ status: 'cancelado' }),
      );

      await expect(
        service.update('order-1', { status: 'pago' }, mockAdmin),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('cancela marcando o status em vez de apagar a linha', async () => {
      orderRepository.findById.mockResolvedValue(makeOrder());
      orderRepository.update.mockResolvedValue(
        makeOrder({ status: 'cancelado' }),
      );

      await service.cancel('order-1', mockAuthUser);

      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: 'cancelado',
      });
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.cancel('order-1', mockAuthUser),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('recusa cancelar pedido já cancelado com 422', async () => {
      orderRepository.findById.mockResolvedValue(
        makeOrder({ status: 'cancelado' }),
      );

      await expect(
        service.cancel('order-1', mockAuthUser),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('recusa cancelar pedido pago com 422', async () => {
      orderRepository.findById.mockResolvedValue(makeOrder({ status: 'pago' }));

      await expect(
        service.cancel('order-1', mockAuthUser),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });
  });
});
