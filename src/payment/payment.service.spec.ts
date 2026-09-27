import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { payments } from '../database/schema';
import { OrderService } from '../order/order.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

type Payment = typeof payments.$inferSelect;

const ORDER_ID = 'pedido-1';

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    orderId: ORDER_ID,
    paymentMethod: 'pix',
    status: 'pendente',
    amount: 250,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: {
    findByOrderId: jest.Mock<PaymentRepository['findByOrderId']>;
    create: jest.Mock<PaymentRepository['create']>;
    update: jest.Mock<PaymentRepository['update']>;
  };
  let orderService: { findOne: jest.Mock<OrderService['findOne']> };

  beforeEach(async () => {
    paymentRepository = {
      findByOrderId: jest.fn<PaymentRepository['findByOrderId']>(),
      create: jest.fn<PaymentRepository['create']>(),
      update: jest.fn<PaymentRepository['update']>(),
    };
    orderService = { findOne: jest.fn<OrderService['findOne']>() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepository, useValue: paymentRepository },
        { provide: OrderService, useValue: orderService },
      ],
    }).compile();

    service = module.get(PaymentService);

    orderService.findOne.mockResolvedValue({ id: ORDER_ID } as never);
  });

  describe('findOne()', () => {
    it('retorna o payment quando existe', async () => {
      const payment = makePayment();
      paymentRepository.findByOrderId.mockResolvedValue(payment);

      await expect(service.findOne(ORDER_ID)).resolves.toEqual(payment);
      expect(orderService.findOne).toHaveBeenCalledWith(ORDER_ID);
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.findOne(ORDER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(paymentRepository.findByOrderId).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o payment não existe para o pedido', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(undefined);

      await expect(service.findOne(ORDER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    const dto: CreatePaymentDto = {
      paymentMethod: 'pix',
      amount: 250,
    };

    it('cria o payment quando o pedido existe e não tem payment', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(undefined);
      const created = makePayment();
      paymentRepository.create.mockResolvedValue(created);

      const result = await service.create(ORDER_ID, dto);

      expect(orderService.findOne).toHaveBeenCalledWith(ORDER_ID);
      expect(paymentRepository.create).toHaveBeenCalledWith({
        ...dto,
        orderId: ORDER_ID,
      });
      expect(result).toEqual(created);
    });

    it('lança 409 quando o pedido já tem payment registrado', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(makePayment());

      await expect(service.create(ORDER_ID, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(ORDER_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o status do payment existente', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(makePayment());
      const updated = makePayment({ status: 'confirmado' });
      paymentRepository.update.mockResolvedValue(updated);

      const result = await service.update(ORDER_ID, {
        status: 'confirmado',
      });

      expect(paymentRepository.update).toHaveBeenCalledWith('payment-1', {
        status: 'confirmado',
      });
      expect(result).toEqual(updated);
    });

    it('lança NotFound quando o payment não existe', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(undefined);

      await expect(
        service.update(ORDER_ID, { status: 'confirmado' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentRepository.update).not.toHaveBeenCalled();
    });
  });
});
