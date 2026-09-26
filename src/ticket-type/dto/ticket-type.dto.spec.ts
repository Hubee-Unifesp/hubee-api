import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTicketTypeDto } from './create-ticket-type.dto';
import { UpdateTicketTypeDto } from './update-ticket-type.dto';

/**
 * As regras de payload vivem nos decorators do DTO e são aplicadas pelo
 * ValidationPipe, que só roda numa requisição HTTP. Estes testes chamam o
 * class-validator direto para cobrir os valores inválidos sem subir a app.
 */
async function validationErrorsFor(
  dtoClass: typeof CreateTicketTypeDto | typeof UpdateTicketTypeDto,
  payload: unknown,
): Promise<string[]> {
  const dto = plainToInstance(dtoClass, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CreateTicketTypeDto', () => {
  const validPayload = { batch: '1º Lote', price: 100 };

  it('aceita um payload válido', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, validPayload),
    ).resolves.toEqual([]);
  });

  it('recusa payload sem lote', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, { price: 100 }),
    ).resolves.toContain('isString');
  });

  it('recusa lote vazio', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, { ...validPayload, batch: '' }),
    ).resolves.toContain('isNotEmpty');
  });

  it('recusa lote com mais de 100 caracteres', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, {
        ...validPayload,
        batch: 'a'.repeat(101),
      }),
    ).resolves.toContain('maxLength');
  });

  it('recusa payload sem valor', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, { batch: '1º Lote' }),
    ).resolves.toContain('isNumber');
  });

  it('recusa valor zero ou negativo', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, { ...validPayload, price: 0 }),
    ).resolves.toContain('isPositive');

    await expect(
      validationErrorsFor(CreateTicketTypeDto, { ...validPayload, price: -10 }),
    ).resolves.toContain('isPositive');
  });

  it('recusa valor com mais de duas casas decimais', async () => {
    await expect(
      validationErrorsFor(CreateTicketTypeDto, {
        ...validPayload,
        price: 10.999,
      }),
    ).resolves.toContain('isNumber');
  });
});

describe('UpdateTicketTypeDto', () => {
  it('aceita payload vazio', async () => {
    await expect(validationErrorsFor(UpdateTicketTypeDto, {})).resolves.toEqual(
      [],
    );
  });

  it('aceita troca isolada do lote', async () => {
    await expect(
      validationErrorsFor(UpdateTicketTypeDto, { batch: '2º Lote' }),
    ).resolves.toEqual([]);
  });

  it('aceita troca isolada do valor', async () => {
    await expect(
      validationErrorsFor(UpdateTicketTypeDto, { price: 150 }),
    ).resolves.toEqual([]);
  });

  it('recusa lote vazio', async () => {
    await expect(
      validationErrorsFor(UpdateTicketTypeDto, { batch: '' }),
    ).resolves.toContain('isNotEmpty');
  });

  it('recusa valor zero ou negativo', async () => {
    await expect(
      validationErrorsFor(UpdateTicketTypeDto, { price: 0 }),
    ).resolves.toContain('isPositive');
  });
});
