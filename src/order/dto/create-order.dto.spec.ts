import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

/**
 * As regras de payload vivem nos decorators do DTO e são aplicadas pelo
 * ValidationPipe, que só roda numa requisição HTTP. Estes testes chamam o
 * class-validator direto para cobrir os valores inválidos sem subir a app.
 */
async function validationErrorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateOrderDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CreateOrderDto', () => {
  const validUserId = '3f1a6f1e-0b6a-4d4a-9c2e-8e4a1d5b9c77';

  it('aceita um payload válido', async () => {
    await expect(
      validationErrorsFor({ userId: validUserId, totalAmount: 150.5 }),
    ).resolves.toEqual([]);
  });

  it('aceita valor total zero', async () => {
    await expect(
      validationErrorsFor({ userId: validUserId, totalAmount: 0 }),
    ).resolves.toEqual([]);
  });

  it('recusa payload sem comprador', async () => {
    await expect(validationErrorsFor({ totalAmount: 10 })).resolves.toContain(
      'isUuid',
    );
  });

  it('recusa comprador que não é uuid', async () => {
    await expect(
      validationErrorsFor({ userId: 'abc', totalAmount: 10 }),
    ).resolves.toContain('isUuid');
  });

  it('recusa payload sem valor total', async () => {
    await expect(
      validationErrorsFor({ userId: validUserId }),
    ).resolves.toContain('isNumber');
  });

  it('recusa valor total negativo', async () => {
    await expect(
      validationErrorsFor({ userId: validUserId, totalAmount: -1 }),
    ).resolves.toContain('min');
  });

  it('recusa valor total com mais de duas casas decimais', async () => {
    await expect(
      validationErrorsFor({ userId: validUserId, totalAmount: 10.123 }),
    ).resolves.toContain('isNumber');
  });

  it('recusa valor total enviado como texto', async () => {
    await expect(
      validationErrorsFor({ userId: validUserId, totalAmount: '150.50' }),
    ).resolves.toContain('isNumber');
  });
});
