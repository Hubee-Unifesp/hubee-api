import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';
import { CreateTicketsDto } from './create-tickets.dto';
import { UpdateTicketDto } from './update-ticket.dto';

/**
 * As regras de payload vivem nos decorators do DTO e são aplicadas pelo
 * ValidationPipe, que só roda numa requisição HTTP. Estes testes chamam o
 * class-validator direto para cobrir os valores inválidos sem subir a app.
 */
function constraintsOf(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.keys(error.constraints ?? {}),
    ...constraintsOf(error.children ?? []),
  ]);
}

async function validationErrorsFor(
  dtoClass: new () => object,
  payload: unknown,
): Promise<string[]> {
  const dto = plainToInstance(dtoClass, payload);
  return constraintsOf(await validate(dto));
}

const validId = '3f1a6f1e-0b6a-4d4a-9c2e-8e4a1d5b9c77';

describe('CreateTicketsDto', () => {
  const validItem = { eventId: validId, ticketTypeId: validId };

  it('aceita um item sem titular', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, { tickets: [validItem] }),
    ).resolves.toEqual([]);
  });

  it('aceita um item com titular', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, {
        tickets: [{ ...validItem, holderUserId: validId }],
      }),
    ).resolves.toEqual([]);
  });

  it('recusa payload sem a lista de ingressos', async () => {
    await expect(validationErrorsFor(CreateTicketsDto, {})).resolves.toContain(
      'isArray',
    );
  });

  it('recusa lista vazia', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, { tickets: [] }),
    ).resolves.toContain('arrayMinSize');
  });

  it('recusa lote acima de 100 ingressos', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, {
        tickets: Array.from({ length: 101 }, () => validItem),
      }),
    ).resolves.toContain('arrayMaxSize');
  });

  it('recusa item sem evento', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, {
        tickets: [{ ticketTypeId: validId }],
      }),
    ).resolves.toContain('isUuid');
  });

  it('recusa item sem tipo de ingresso', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, {
        tickets: [{ eventId: validId }],
      }),
    ).resolves.toContain('isUuid');
  });

  it('recusa titular que não é UUID', async () => {
    await expect(
      validationErrorsFor(CreateTicketsDto, {
        tickets: [{ ...validItem, holderUserId: 'abc' }],
      }),
    ).resolves.toContain('isUuid');
  });
});

describe('UpdateTicketDto', () => {
  it.each(['emitido', 'usado', 'cancelado'])(
    'aceita o status %s',
    async (status) => {
      await expect(
        validationErrorsFor(UpdateTicketDto, { status }),
      ).resolves.toEqual([]);
    },
  );

  it('recusa payload sem status', async () => {
    await expect(validationErrorsFor(UpdateTicketDto, {})).resolves.toContain(
      'isIn',
    );
  });

  it('recusa status fora do enum', async () => {
    await expect(
      validationErrorsFor(UpdateTicketDto, { status: 'reembolsado' }),
    ).resolves.toContain('isIn');
  });
});
