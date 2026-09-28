import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

const ORDER_ID = 'pedido-1';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: {
    findOne: jest.Mock<PaymentService['findOne']>;
    create: jest.Mock<PaymentService['create']>;
    update: jest.Mock<PaymentService['update']>;
  };

  beforeEach(async () => {
    service = {
      findOne: jest.fn<PaymentService['findOne']>(),
      create: jest.fn<PaymentService['create']>(),
      update: jest.fn<PaymentService['update']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: service }],
    }).compile();

    controller = module.get(PaymentController);
  });

  it('POST /orders/:orderId/payment delega para paymentService.create()', async () => {
    const dto: CreatePaymentDto = {
      paymentMethod: 'pix',
      amount: 250,
    };
    const created = { id: 'payment-1', orderId: ORDER_ID, ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(ORDER_ID, dto);

    expect(service.create).toHaveBeenCalledWith(ORDER_ID, dto);
    expect(result).toEqual(created);
  });

  it('GET /orders/:orderId/payment delega para paymentService.findOne()', async () => {
    const payment = { id: 'payment-1' } as never;
    service.findOne.mockResolvedValue(payment);

    const result = await controller.findOne(ORDER_ID);

    expect(service.findOne).toHaveBeenCalledWith(ORDER_ID);
    expect(result).toEqual(payment);
  });

  it('PATCH /orders/:orderId/payment delega para paymentService.update()', async () => {
    const dto: UpdatePaymentDto = { status: 'confirmado' };
    const updated = { id: 'payment-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update(ORDER_ID, dto);

    expect(service.update).toHaveBeenCalledWith(ORDER_ID, dto);
    expect(result).toEqual(updated);
  });
});
