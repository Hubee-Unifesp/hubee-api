import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE } from '../database/database.constants';
import { payments } from '../database/schema';
import { OrderService } from '../order/order.service';
import { TicketService } from '../ticket/ticket.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

type Payment = typeof payments.$inferSelect;

const ORDER_ID = 'pedido-1';
const BUYER = {
  id: 'buyer-1',
  email: 'buyer@example.com',
  role: 'USER' as const,
};
const OTHER_USER = { ...BUYER, id: 'other-1' };
const ADMIN = { ...BUYER, id: 'admin-1', role: 'ADMIN' as const };

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
  let orderService: {
    findById: jest.Mock<OrderService['findById']>;
    lockPendingForCheckout: jest.Mock<OrderService['lockPendingForCheckout']>;
    markAsPaid: jest.Mock<OrderService['markAsPaid']>;
    findItems: jest.Mock<OrderService['findItems']>;
  };
  let ticketService: {
    issueForPaidOrder: jest.Mock<TicketService['issueForPaidOrder']>;
  };
  const tx = { tx: true };
  const db = {
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  };

  beforeEach(async () => {
    paymentRepository = {
      findByOrderId: jest.fn<PaymentRepository['findByOrderId']>(),
      create: jest.fn<PaymentRepository['create']>(),
      update: jest.fn<PaymentRepository['update']>(),
    };
    orderService = {
      findById: jest.fn<OrderService['findById']>(),
      lockPendingForCheckout: jest.fn<OrderService['lockPendingForCheckout']>(),
      markAsPaid: jest.fn<OrderService['markAsPaid']>(),
      findItems: jest.fn<OrderService['findItems']>(),
    };
    ticketService = {
      issueForPaidOrder: jest.fn<TicketService['issueForPaidOrder']>(),
    };
    db.transaction.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: DRIZZLE, useValue: db },
        { provide: PaymentRepository, useValue: paymentRepository },
        { provide: OrderService, useValue: orderService },
        { provide: TicketService, useValue: ticketService },
      ],
    }).compile();

    service = module.get(PaymentService);

    orderService.findById.mockResolvedValue({
      id: ORDER_ID,
      userId: BUYER.id,
    } as never);
  });

  describe('findOne()', () => {
    it('retorna o payment quando existe', async () => {
      const payment = makePayment();
      paymentRepository.findByOrderId.mockResolvedValue(payment);

      await expect(service.findOne(ORDER_ID, BUYER)).resolves.toEqual(payment);
      expect(orderService.findById).toHaveBeenCalledWith(ORDER_ID);
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findById.mockRejectedValue(new NotFoundException());

      await expect(service.findOne(ORDER_ID, BUYER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(paymentRepository.findByOrderId).not.toHaveBeenCalled();
    });

    it('ADMIN consulta o pagamento de qualquer pedido', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(makePayment());

      await expect(service.findOne(ORDER_ID, ADMIN)).resolves.toBeDefined();
    });

    it('lança NotFound quando o pedido é de outra pessoa', async () => {
      await expect(
        service.findOne(ORDER_ID, OTHER_USER),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentRepository.findByOrderId).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o payment não existe para o pedido', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(undefined);

      await expect(service.findOne(ORDER_ID, BUYER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('checkout()', () => {
    const dto = { orderId: ORDER_ID, paymentMethod: 'pix' as const };
    const pendingOrder = {
      id: ORDER_ID,
      userId: BUYER.id,
      status: 'pendente' as const,
      totalAmount: 250.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const paidOrder = { ...pendingOrder, status: 'pago' as const };
    const items = [
      {
        id: 'item-1',
        orderId: ORDER_ID,
        ticketTypeId: 'type-1',
        quantity: 2,
        unitPrice: 125.25,
        createdAt: new Date(),
        ticketType: { eventId: 'event-1' },
      },
    ];

    beforeEach(() => {
      orderService.lockPendingForCheckout.mockResolvedValue(pendingOrder);
      orderService.markAsPaid.mockResolvedValue(paidOrder);
      orderService.findItems.mockResolvedValue(items as never);
      paymentRepository.findByOrderId.mockResolvedValue(undefined);
      paymentRepository.create.mockImplementation(async (data) =>
        makePayment({ ...data, id: 'payment-1' }),
      );
      ticketService.issueForPaidOrder.mockResolvedValue([]);
    });

    it('confirma o pagamento do total do pedido, paga o pedido e emite os ingressos na mesma transaction', async () => {
      const result = await service.checkout(dto, BUYER);

      expect(orderService.lockPendingForCheckout).toHaveBeenCalledWith(
        ORDER_ID,
        BUYER,
        tx,
      );
      expect(paymentRepository.create).toHaveBeenCalledWith(
        {
          orderId: ORDER_ID,
          paymentMethod: 'pix',
          amount: 250.5,
          status: 'confirmado',
          paidAt: expect.any(Date),
        },
        tx,
      );
      expect(orderService.markAsPaid).toHaveBeenCalledWith(ORDER_ID, tx);
      expect(ticketService.issueForPaidOrder).toHaveBeenCalledWith(
        paidOrder,
        items,
        tx,
      );
      expect(result).toMatchObject({ status: 'confirmado', amount: 250.5 });
    });

    it('só emite os ingressos depois de marcar o pedido como pago', async () => {
      const calls: string[] = [];
      orderService.markAsPaid.mockImplementation(async () => {
        calls.push('markAsPaid');
        return paidOrder;
      });
      ticketService.issueForPaidOrder.mockImplementation(async () => {
        calls.push('issueForPaidOrder');
        return [];
      });

      await service.checkout(dto, BUYER);

      expect(calls).toEqual(['markAsPaid', 'issueForPaidOrder']);
    });

    it('não paga nem emite quando o pedido não pode ser pago', async () => {
      orderService.lockPendingForCheckout.mockRejectedValue(
        new UnprocessableEntityException('Pedido já foi pago'),
      );

      await expect(service.checkout(dto, BUYER)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(orderService.markAsPaid).not.toHaveBeenCalled();
      expect(ticketService.issueForPaidOrder).not.toHaveBeenCalled();
    });

    it('não paga nem emite quando o pedido é de outra pessoa', async () => {
      orderService.lockPendingForCheckout.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(service.checkout(dto, OTHER_USER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(ticketService.issueForPaidOrder).not.toHaveBeenCalled();
    });

    it('lança 409 e não emite quando o pedido já tem pagamento registrado', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(makePayment());

      await expect(service.checkout(dto, BUYER)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(paymentRepository.create).not.toHaveBeenCalled();
      expect(ticketService.issueForPaidOrder).not.toHaveBeenCalled();
    });

    it('propaga a falha da emissão para a transaction desfazer o pagamento', async () => {
      ticketService.issueForPaidOrder.mockRejectedValue(new Error('db fora'));

      await expect(service.checkout(dto, BUYER)).rejects.toThrow('db fora');
      expect(db.transaction).toHaveBeenCalledTimes(1);
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

      const result = await service.create(ORDER_ID, dto, BUYER);

      expect(orderService.findById).toHaveBeenCalledWith(ORDER_ID);
      expect(paymentRepository.create).toHaveBeenCalledWith({
        ...dto,
        orderId: ORDER_ID,
      });
      expect(result).toEqual(created);
    });

    it('lança NotFound e não cria quando o pedido é de outra pessoa', async () => {
      await expect(
        service.create(ORDER_ID, dto, OTHER_USER),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('lança 409 quando o pedido já tem payment registrado', async () => {
      paymentRepository.findByOrderId.mockResolvedValue(makePayment());

      await expect(service.create(ORDER_ID, dto, BUYER)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findById.mockRejectedValue(new NotFoundException());

      await expect(service.create(ORDER_ID, dto, BUYER)).rejects.toBeInstanceOf(
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
