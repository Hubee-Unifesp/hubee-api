import { SimulatedPaymentGateway } from './simulated-payment-gateway';

describe('SimulatedPaymentGateway', () => {
  const gateway = new SimulatedPaymentGateway();

  it.each(['pix', 'cartao_credito', 'boleto'] as const)(
    'aprova na hora a cobrança via %s',
    async (paymentMethod) => {
      const before = Date.now();

      const result = await gateway.charge({
        orderId: 'pedido-1',
        amount: 250.5,
        paymentMethod,
      });

      expect(result.status).toBe('confirmado');
      if (result.status !== 'confirmado') return;
      expect(result.paidAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.paidAt.getTime()).toBeLessThanOrEqual(Date.now());
    },
  );
});
