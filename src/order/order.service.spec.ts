import { jest } from '@jest/globals';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { orders } from '../database/schema';
import { UsuariosService } from '../usuarios/usuarios.service';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

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
  let usuariosService: {
    findOne: jest.Mock<UsuariosService['findOne']>;
  };

  beforeEach(async () => {
    orderRepository = {
      findAll: jest.fn<OrderRepository['findAll']>(),
      findById: jest.fn<OrderRepository['findById']>(),
      create: jest.fn<OrderRepository['create']>(),
      update: jest.fn<OrderRepository['update']>(),
    };
    usuariosService = {
      findOne: jest.fn<UsuariosService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: orderRepository },
        { provide: UsuariosService, useValue: usuariosService },
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
  });

  describe('findOne()', () => {
    it('retorna o pedido quando ele existe', async () => {
      const order = makeOrder();
      orderRepository.findById.mockResolvedValue(order);

      await expect(service.findOne('order-1')).resolves.toEqual(order);
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(service.findOne('order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    it('cria o pedido depois de confirmar que o comprador existe', async () => {
      const created = makeOrder();
      usuariosService.findOne.mockResolvedValue({ id: 'user-1' });
      orderRepository.create.mockResolvedValue(created);

      const result = await service.create({
        userId: 'user-1',
        totalAmount: 150.5,
      });

      expect(usuariosService.findOne).toHaveBeenCalledWith('user-1');
      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        totalAmount: 150.5,
      });
      expect(result).toEqual(created);
    });

    it('lança NotFound e não cria quando o comprador não existe', async () => {
      usuariosService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.create({ userId: 'user-1', totalAmount: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('propaga erros inesperados da consulta de usuários', async () => {
      usuariosService.findOne.mockRejectedValue(new Error('conexão perdida'));

      await expect(
        service.create({ userId: 'user-1', totalAmount: 10 }),
      ).rejects.toThrow('conexão perdida');
      expect(orderRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o status de um pedido pendente', async () => {
      const updated = makeOrder({ status: 'pago' });
      orderRepository.findById.mockResolvedValue(makeOrder());
      orderRepository.update.mockResolvedValue(updated);

      const result = await service.update('order-1', { status: 'pago' });

      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: 'pago',
      });
      expect(result).toEqual(updated);
    });

    it('lança NotFound e não escreve quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('order-1', { status: 'pago' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('recusa alteração de pedido cancelado com 422', async () => {
      orderRepository.findById.mockResolvedValue(
        makeOrder({ status: 'cancelado' }),
      );

      await expect(
        service.update('order-1', { status: 'pago' }),
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

      await service.cancel('order-1');

      expect(orderRepository.update).toHaveBeenCalledWith('order-1', {
        status: 'cancelado',
      });
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(service.cancel('order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('recusa cancelar pedido já cancelado com 422', async () => {
      orderRepository.findById.mockResolvedValue(
        makeOrder({ status: 'cancelado' }),
      );

      await expect(service.cancel('order-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it('recusa cancelar pedido pago com 422', async () => {
      orderRepository.findById.mockResolvedValue(makeOrder({ status: 'pago' }));

      await expect(service.cancel('order-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });
  });
});
