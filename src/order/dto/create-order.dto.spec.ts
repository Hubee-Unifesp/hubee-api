import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

async function validationErrorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateOrderDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CreateOrderDto', () => {
  it('aceita um payload válido', async () => {
    await expect(
      validationErrorsFor({ totalAmount: 150.5 }),
    ).resolves.toEqual([]);
  });

  it('aceita valor total zero', async () => {
    await expect(
      validationErrorsFor({ totalAmount: 0 }),
    ).resolves.toEqual([]);
  });

  it('recusa payload sem valor total', async () => {
    await expect(validationErrorsFor({})).resolves.toContain('isNumber');
  });

  it('recusa valor total negativo', async () => {
    await expect(validationErrorsFor({ totalAmount: -1 })).resolves.toContain(
      'min',
    );
  });

  it('recusa valor total com mais de duas casas decimais', async () => {
    await expect(validationErrorsFor({ totalAmount: 10.123 })).resolves.toContain(
      'isNumber',
    );
  });

  it('recusa valor total enviado como texto', async () => {
    await expect(validationErrorsFor({ totalAmount: '150.50' })).resolves.toContain(
      'isNumber',
    );
  });
});