import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

const TICKET_TYPE_ID = '3f2b8f0e-6d1c-4a52-9a0e-0c6f1f3a7b11';

async function validationErrorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateOrderDto, payload);
  const errors = await validate(dto);
  const flatten = (list: typeof errors): string[] =>
    list.flatMap((error) => [
      ...Object.keys(error.constraints ?? {}),
      ...flatten(error.children ?? []),
    ]);
  return flatten(errors);
}

describe('CreateOrderDto', () => {
  it('aceita um pedido com um item válido', async () => {
    await expect(
      validationErrorsFor({
        items: [{ ticketTypeId: TICKET_TYPE_ID, quantity: 2 }],
      }),
    ).resolves.toEqual([]);
  });

  it('aceita itens de lotes diferentes', async () => {
    await expect(
      validationErrorsFor({
        items: [
          { ticketTypeId: TICKET_TYPE_ID, quantity: 1 },
          { ticketTypeId: '9c1d7b2a-1e0f-4c3b-8a55-2d4e6f8a0b22', quantity: 4 },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('recusa payload sem itens', async () => {
    await expect(validationErrorsFor({})).resolves.toContain('isArray');
  });

  it('recusa lista de itens vazia', async () => {
    await expect(validationErrorsFor({ items: [] })).resolves.toContain(
      'arrayMinSize',
    );
  });

  it('recusa mais de 20 itens', async () => {
    const items = Array.from({ length: 21 }, () => ({
      ticketTypeId: TICKET_TYPE_ID,
      quantity: 1,
    }));
    await expect(validationErrorsFor({ items })).resolves.toContain(
      'arrayMaxSize',
    );
  });

  it('recusa lote que não é UUID', async () => {
    await expect(
      validationErrorsFor({ items: [{ ticketTypeId: 'abc', quantity: 1 }] }),
    ).resolves.toContain('isUuid');
  });

  it.each([0, -1])('recusa quantidade %s', async (quantity) => {
    await expect(
      validationErrorsFor({
        items: [{ ticketTypeId: TICKET_TYPE_ID, quantity }],
      }),
    ).resolves.toContain('min');
  });

  it('recusa quantidade acima do limite por lote', async () => {
    await expect(
      validationErrorsFor({
        items: [{ ticketTypeId: TICKET_TYPE_ID, quantity: 11 }],
      }),
    ).resolves.toContain('max');
  });

  it('recusa quantidade fracionada', async () => {
    await expect(
      validationErrorsFor({
        items: [{ ticketTypeId: TICKET_TYPE_ID, quantity: 1.5 }],
      }),
    ).resolves.toContain('isInt');
  });

  it('recusa quantidade enviada como texto', async () => {
    await expect(
      validationErrorsFor({
        items: [{ ticketTypeId: TICKET_TYPE_ID, quantity: '2' }],
      }),
    ).resolves.toContain('isInt');
  });
});
