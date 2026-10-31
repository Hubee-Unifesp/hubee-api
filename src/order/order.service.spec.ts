import { jest } from '@jest/globals';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../database/database.constants';
import { events, orderItems, orders, ticketTypes } from '../database/schema';
import { TicketTypeService } from '../ticket-type/ticket-type.service';
import { UsersService } from '../users/users.service';
import { OrderItemRepository } from './order-item.repository';
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

type Event = typeof events.$inferSelect;
type TicketType = typeof ticketTypes.$inferSelect;
type OrderItem = typeof orderItems.$inferSelect;

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Festa Junina',
    description: null,
    ageRating: null,
    organizerId: 'org-1',
    venueId: 'venue-1',
    startDate: new Date('2999-06-20T18:00:00Z'),
    endDate: new Date('2999-06-20T23:00:00Z'),
    salesStartDate: null,
    status: 'published',
    category: null,
    edition: null,
    photoUrl: null,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTicketType(overrides: Partial<TicketType> = {}): TicketType {
  return {
    id: 'type-1',
    eventId: 'event-1',
    batch: '1º lote',
    price: 50,
    quantity: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    orderId: 'order-1',
    ticketTypeId: 'type-1',
    quantity: 2,
    unitPrice: 50,
    createdAt: new Date(),
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
    findByIdForUpdate: jest.Mock<OrderRepository['findByIdForUpdate']>;
  };
  let orderItemRepository: {
    findByOrder: jest.Mock<OrderItemRepository['findByOrder']>;
    createMany: jest.Mock<OrderItemRepository['createMany']>;
    sumReservedByTicketType: jest.Mock<
      OrderItemRepository['sumReservedByTicketType']
    >;
  };
  let usersService: {
    findOne: jest.Mock<UsersService['findOne']>;
  };
  let ticketTypeService: {
    lockForPurchase: jest.Mock<TicketTypeService['lockForPurchase']>;
  };
  const tx = { tx: true };
  const db = {
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
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
    db.transaction.mockClear();
    orderRepository = {
      findAll: jest.fn<OrderRepository['findAll']>(),
      findById: jest.fn<OrderRepository['findById']>(),
      create: jest.fn<OrderRepository['create']>(),
      update: jest.fn<OrderRepository['update']>(),
      findByIdForUpdate: jest.fn<OrderRepository['findByIdForUpdate']>(),
    };
    orderItemRepository = {
      findByOrder: jest.fn<OrderItemRepository['findByOrder']>(),
      createMany: jest.fn<OrderItemRepository['createMany']>(),
      sumReservedByTicketType:
        jest.fn<OrderItemRepository['sumReservedByTicketType']>(),
    };
    ticketTypeService = {
      lockForPurchase: jest.fn<TicketTypeService['lockForPurchase']>(),
    };
    usersService = {
      findOne: jest.fn<UsersService['findOne']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: DRIZZLE, useValue: db },
        { provide: OrderRepository, useValue: orderRepository },
        { provide: OrderItemRepository, useValue: orderItemRepository },
        { provide: UsersService, useValue: usersService },
        { provide: TicketTypeService, useValue: ticketTypeService },
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

  describe('findById()', () => {
    it('retorna o pedido quando ele existe sem checagem de usuário', async () => {
      const order = makeOrder();
      orderRepository.findById.mockResolvedValue(order);

      await expect(service.findById('order-1')).resolves.toEqual(order);
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderRepository.findById.mockResolvedValue(undefined);

      await expect(service.findById('order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findOne()', () => {
    it('retorna o pedido quando ele pertence ao usuário autenticado', async () => {
      const order = makeOrder({ userId: 'user-1' });
      const items = [{ ...makeItem(), ticketType: makeTicketType() }];
      orderRepository.findById.mockResolvedValue(order);
      orderItemRepository.findByOrder.mockResolvedValue(items);

      await expect(service.findOne('order-1', mockAuthUser)).resolves.toEqual({
        ...order,
        items,
      });
    });

    it('retorna o pedido para ADMIN mesmo sendo de outro usuário', async () => {
      const order = makeOrder({ userId: 'outro-usuario' });
      orderRepository.findById.mockResolvedValue(order);
      orderItemRepository.findByOrder.mockResolvedValue([]);

      await expect(service.findOne('order-1', mockAdmin)).resolves.toEqual({
        ...order,
        items: [],
      });
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
    const completeProfile = {
      id: 'user-1',
      cpf: '123',
      birthDate: '1990-01-01',
    } as never;

    function givenLot(
      ticketType: Partial<TicketType> = {},
      event: Partial<Event> = {},
      reserved = 0,
    ) {
      const lot = {
        ticketType: makeTicketType(ticketType),
        event: makeEvent(event),
      };
      ticketTypeService.lockForPurchase.mockResolvedValue([lot]);
      orderItemRepository.sumReservedByTicketType.mockResolvedValue(
        new Map(reserved ? [[lot.ticketType.id, reserved]] : []),
      );
      return lot;
    }

    beforeEach(() => {
      usersService.findOne.mockResolvedValue(completeProfile);
      orderRepository.create.mockImplementation(async (data) =>
        makeOrder({ ...data, id: 'order-1' }),
      );
      orderItemRepository.createMany.mockImplementation(async (data) =>
        data.map((item, index) => makeItem({ ...item, id: `item-${index}` })),
      );
    });

    it('cria o pedido e os itens na mesma transaction, com o total calculado no servidor', async () => {
      givenLot({ price: 50.1 });

      const result = await service.create(mockAuthUser, {
        items: [{ ticketTypeId: 'type-1', quantity: 3 }],
      });

      expect(ticketTypeService.lockForPurchase).toHaveBeenCalledWith(
        ['type-1'],
        tx,
      );
      expect(orderRepository.create).toHaveBeenCalledWith(
        { userId: 'user-1', totalAmount: 150.3 },
        tx,
      );
      expect(orderItemRepository.createMany).toHaveBeenCalledWith(
        [
          {
            orderId: 'order-1',
            ticketTypeId: 'type-1',
            quantity: 3,
            unitPrice: 50.1,
          },
        ],
        tx,
      );
      expect(result.status).toBe('pendente');
      expect(result.totalAmount).toBe(150.3);
      expect(result.items).toHaveLength(1);
    });

    it('soma as linhas repetidas do mesmo lote antes de conferir o saldo', async () => {
      givenLot({ quantity: 5 });

      await expect(
        service.create(mockAuthUser, {
          items: [
            { ticketTypeId: 'type-1', quantity: 3 },
            { ticketTypeId: 'type-1', quantity: 3 },
          ],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('permite comprar exatamente o saldo que sobrou', async () => {
      givenLot({ quantity: 10 }, {}, 8);

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 2 }],
        }),
      ).resolves.toMatchObject({ totalAmount: 100 });
    });

    it('recusa lote esgotado com 422 e não grava nada', async () => {
      givenLot({ quantity: 10 }, {}, 10);

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 1 }],
        }),
      ).rejects.toThrow('está esgotado');
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(orderItemRepository.createMany).not.toHaveBeenCalled();
    });

    it('recusa quantidade maior que o saldo e informa quanto resta', async () => {
      givenLot({ quantity: 10 }, {}, 8);

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 3 }],
        }),
      ).rejects.toThrow('tem apenas 2 ingresso(s) disponível(is)');
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('um item sem saldo derruba o pedido inteiro, mesmo que os outros tenham', async () => {
      const ok = {
        ticketType: makeTicketType({ id: 'type-1', quantity: 10 }),
        event: makeEvent(),
      };
      const sold = {
        ticketType: makeTicketType({ id: 'type-2', quantity: 1 }),
        event: makeEvent(),
      };
      ticketTypeService.lockForPurchase.mockResolvedValue([ok, sold]);
      orderItemRepository.sumReservedByTicketType.mockResolvedValue(
        new Map([['type-2', 1]]),
      );

      await expect(
        service.create(mockAuthUser, {
          items: [
            { ticketTypeId: 'type-1', quantity: 1 },
            { ticketTypeId: 'type-2', quantity: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o lote não existe', async () => {
      ticketTypeService.lockForPurchase.mockResolvedValue([]);
      orderItemRepository.sumReservedByTicketType.mockResolvedValue(new Map());

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      ['rascunho', { status: 'draft' as const }],
      ['cancelado', { status: 'cancelled' as const }],
      ['encerrado', { status: 'finished' as const }],
      ['com vendas ainda fechadas', { salesStartDate: new Date('2999-01-01') }],
      ['que já terminou', { endDate: new Date('2000-01-01') }],
    ])('recusa comprar de evento %s', async (_label, event) => {
      givenLot({}, event);

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 1 }],
        }),
      ).rejects.toThrow('não estão abertas');
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('recusa criar pedido se perfil estiver incompleto', async () => {
      usersService.findOne.mockResolvedValue({ id: 'user-1' } as never);

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 1 }],
        }),
      ).rejects.toMatchObject({
        response: {
          statusCode: 403,
          error: 'Forbidden',
          code: 'PROFILE_INCOMPLETE',
          missing: ['cpf', 'birthDate'],
        },
      });
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('lança NotFound e não cria quando o comprador não existe', async () => {
      usersService.findOne.mockRejectedValue(
        new NotFoundException('Usuário não encontrado.'),
      );

      await expect(
        service.create(mockAuthUser, {
          items: [{ ticketTypeId: 'type-1', quantity: 1 }],
        }),
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

  describe('lockPendingForCheckout()', () => {
    it('devolve o pedido pendente do próprio usuário, travado na transaction', async () => {
      const order = makeOrder();
      orderRepository.findByIdForUpdate.mockResolvedValue(order);

      await expect(
        service.lockPendingForCheckout('order-1', mockAuthUser, tx as never),
      ).resolves.toEqual(order);
      expect(orderRepository.findByIdForUpdate).toHaveBeenCalledWith(
        'order-1',
        tx,
      );
    });

    it('responde NotFound para pedido inexistente', async () => {
      orderRepository.findByIdForUpdate.mockResolvedValue(undefined);

      await expect(
        service.lockPendingForCheckout('order-1', mockAuthUser, tx as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('responde NotFound para pedido de outra pessoa', async () => {
      orderRepository.findByIdForUpdate.mockResolvedValue(
        makeOrder({ userId: 'outro-usuario' }),
      );

      await expect(
        service.lockPendingForCheckout('order-1', mockAuthUser, tx as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['pago', 'cancelado'] as const)(
      'recusa pedido %s com 422',
      async (status) => {
        orderRepository.findByIdForUpdate.mockResolvedValue(
          makeOrder({ status }),
        );

        await expect(
          service.lockPendingForCheckout('order-1', mockAuthUser, tx as never),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);
      },
    );
  });

  describe('markAsPaid()', () => {
    it('muda o status para pago dentro da transaction recebida', async () => {
      const paid = makeOrder({ status: 'pago' });
      orderRepository.update.mockResolvedValue(paid);

      await expect(service.markAsPaid('order-1', tx as never)).resolves.toBe(
        paid,
      );
      expect(orderRepository.update).toHaveBeenCalledWith(
        'order-1',
        { status: 'pago' },
        tx,
      );
    });
  });
});
