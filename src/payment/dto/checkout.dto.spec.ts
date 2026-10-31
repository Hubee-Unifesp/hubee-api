import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckoutDto } from './checkout.dto';

const ORDER_ID = '3f2b8f0e-6d1c-4a52-9a0e-0c6f1f3a7b11';

async function validationErrorsFor(payload: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(CheckoutDto, payload));
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CheckoutDto', () => {
  it.each([
    'cartao_credito',
    'cartao_debito',
    'pix',
    'boleto',
    'transferencia',
  ])('aceita pagamento por %s', async (paymentMethod) => {
    await expect(
      validationErrorsFor({ orderId: ORDER_ID, paymentMethod }),
    ).resolves.toEqual([]);
  });

  it('recusa pedido que não é UUID', async () => {
    await expect(
      validationErrorsFor({ orderId: '123', paymentMethod: 'pix' }),
    ).resolves.toContain('isUuid');
  });

  it('recusa forma de pagamento desconhecida', async () => {
    await expect(
      validationErrorsFor({ orderId: ORDER_ID, paymentMethod: 'cheque' }),
    ).resolves.toContain('isIn');
  });

  it('recusa payload vazio', async () => {
    await expect(validationErrorsFor({})).resolves.toEqual(
      expect.arrayContaining(['isUuid', 'isIn']),
    );
  });
});
