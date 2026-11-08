import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrderDto } from './update-order.dto';

/** Mesmas opções do `ValidationPipe` global (`main.ts`). */
const validateLikeApp = (body: object) =>
  validate(plainToInstance(UpdateOrderDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateOrderDto', () => {
  it('aceita status válido', async () => {
    await expect(validateLikeApp({ status: 'cancelado' })).resolves.toEqual([]);
  });

  it('recusa status fora do enum', async () => {
    const errors = await validateLikeApp({ status: 'estornado' });

    expect(errors.map((error) => error.property)).toEqual(['status']);
  });

  it('recusa totalAmount: o total do pedido não é editável', async () => {
    const errors = await validateLikeApp({ totalAmount: 0 });

    expect(errors.map((error) => error.property)).toEqual(['totalAmount']);
    expect(errors[0].constraints).toHaveProperty('whitelistValidation');
  });
});
