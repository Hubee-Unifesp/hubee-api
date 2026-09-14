import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

describe('OrderController', () => {
  let controller: OrderController;
  let service: {
    findAll: jest.Mock<OrderService['findAll']>;
    findOne: jest.Mock<OrderService['findOne']>;
    create: jest.Mock<OrderService['create']>;
    update: jest.Mock<OrderService['update']>;
    cancel: jest.Mock<OrderService['cancel']>;
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
    }).compile();

    controller = module.get(OrderController);
  });

  it('POST /pedidos delega para orderService.create()', async () => {
    const dto: CreateOrderDto = { userId: 'user-1', totalAmount: 150.5 };
    const created = { id: 'order-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('GET /pedidos delega para orderService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'order-1' }] as never;
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
  });

  it('GET /pedidos/:id delega para orderService.findOne()', async () => {
    const order = { id: 'order-1' } as never;
    service.findOne.mockResolvedValue(order);

    const result = await controller.findOne('order-1');

    expect(service.findOne).toHaveBeenCalledWith('order-1');
    expect(result).toEqual(order);
  });

  it('PATCH /pedidos/:id delega para orderService.update()', async () => {
    const dto: UpdateOrderDto = { status: 'pago' };
    const updated = { id: 'order-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('order-1', dto);

    expect(service.update).toHaveBeenCalledWith('order-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /pedidos/:id delega para orderService.cancel()', async () => {
    service.cancel.mockResolvedValue(undefined);

    await controller.remove('order-1');

    expect(service.cancel).toHaveBeenCalledWith('order-1');
  });
});
