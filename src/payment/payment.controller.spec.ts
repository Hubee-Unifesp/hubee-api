import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentResponseDto } from './dto/payment-response.dto';

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'payment-1',
  orderId: 'pedido-1',
  paymentMethod: 'pix' as const,
  status: 'pendente' as const,
  amount: 250,
  paidAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

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
      imports: [JwtModule.register({ secret: 'test-secret' })],
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
    const created = row as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(ORDER_ID, dto);

    expect(service.create).toHaveBeenCalledWith(ORDER_ID, dto);
    expect(result).toEqual(created);
    expect(result).toBeInstanceOf(PaymentResponseDto);
  });

  it('GET /orders/:orderId/payment delega para paymentService.findOne()', async () => {
    const payment = row as never;
    service.findOne.mockResolvedValue(payment);

    const result = await controller.findOne(ORDER_ID);

    expect(service.findOne).toHaveBeenCalledWith(ORDER_ID);
    expect(result).toEqual(payment);
    expect(result).toBeInstanceOf(PaymentResponseDto);
  });

  it('PATCH /orders/:orderId/payment delega para paymentService.update()', async () => {
    const dto: UpdatePaymentDto = { status: 'confirmado' };
    const updated = row as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update(ORDER_ID, dto);

    expect(service.update).toHaveBeenCalledWith(ORDER_ID, dto);
    expect(result).toEqual(updated);
    expect(result).toBeInstanceOf(PaymentResponseDto);
  });
});
