import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentService } from './payment.service';

const USER = { id: 'user-1', email: 'user@example.com', role: 'USER' as const };

/** Linha completa do banco, como o service a retorna. */
const row = {
  id: 'payment-1',
  orderId: 'order-1',
  paymentMethod: 'pix' as const,
  status: 'confirmado' as const,
  amount: 250,
  paidAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let service: { checkout: jest.Mock<PaymentService['checkout']> };

  beforeEach(async () => {
    service = { checkout: jest.fn<PaymentService['checkout']>() };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [CheckoutController],
      providers: [{ provide: PaymentService, useValue: service }],
    }).compile();

    controller = module.get(CheckoutController);
  });

  it('POST /payments delega para paymentService.checkout() com o usuário logado', async () => {
    const dto: CheckoutDto = { orderId: 'order-1', paymentMethod: 'pix' };
    service.checkout.mockResolvedValue(row);

    const result = await controller.checkout(dto, USER);

    expect(service.checkout).toHaveBeenCalledWith(dto, USER);
    expect(result).toEqual(row);
    expect(result).toBeInstanceOf(PaymentResponseDto);
  });
});
