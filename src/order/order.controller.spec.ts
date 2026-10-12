import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderResponseDto } from './dto/order-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'order-1',
  userId: 'user-1',
  totalAmount: 150.5,
  status: 'pendente' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('OrderController', () => {
  let controller: OrderController;
  let service: {
    findAll: jest.Mock<OrderService['findAll']>;
    findOne: jest.Mock<OrderService['findOne']>;
    create: jest.Mock<OrderService['create']>;
    update: jest.Mock<OrderService['update']>;
    cancel: jest.Mock<OrderService['cancel']>;
  };

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'teste@exemplo.com',
    role: 'USER',
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<OrderService['findAll']>(),
      findOne: jest.fn<OrderService['findOne']>(),
      create: jest.fn<OrderService['create']>(),
      update: jest.fn<OrderService['update']>(),
      cancel: jest.fn<OrderService['cancel']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrderController);
  });

  it('POST /orders delega para orderService.create() passando o utilizador', async () => {
    const dto: CreateOrderDto = { totalAmount: 150.5 };
    const created = { id: 'order-1', userId: mockUser.id, ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(mockUser, dto);

    expect(service.create).toHaveBeenCalledWith(mockUser, dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(OrderResponseDto);
  });

  it('GET /orders delega para orderService.findAll() com os filtros da query', async () => {
    const list = [row] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll({
      userId: 'user-1',
      status: 'pago',
    });

    expect(service.findAll).toHaveBeenCalledWith({
      userId: 'user-1',
      status: 'pago',
    });
    expect(result).toEqual(list);
    expect(result[0]).toBeInstanceOf(OrderResponseDto);
  });

  it('GET /orders/:id delega para orderService.findOne() com utilizador', async () => {
    const order = { id: 'order-1' } as never;
    service.findOne.mockResolvedValue(order);

    const result = await controller.findOne('order-1', mockUser);

    expect(service.findOne).toHaveBeenCalledWith('order-1', mockUser);
    expect(result).toEqual(order);
    expect(result).toBeInstanceOf(OrderResponseDto);
  });

  it('PATCH /orders/:id delega para orderService.update() com utilizador', async () => {
    const dto: UpdateOrderDto = { status: 'pago' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('order-1', mockUser, dto);

    expect(service.update).toHaveBeenCalledWith('order-1', dto, mockUser);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(OrderResponseDto);
  });

  it('DELETE /orders/:id delega para orderService.cancel() com utilizador', async () => {
    service.cancel.mockResolvedValue(undefined);

    await controller.remove('order-1', mockUser);

    expect(service.cancel).toHaveBeenCalledWith('order-1', mockUser);
  });
});
