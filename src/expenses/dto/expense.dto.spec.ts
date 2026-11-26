import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExpenseDto, MAX_EXPENSE_AMOUNT } from './create-expense.dto';
import { QueryExpenseDto } from './query-expense.dto';
import { UpdateExpenseDto } from './update-expense.dto';

async function validationErrorsFor(
  dtoClass:
    typeof CreateExpenseDto | typeof UpdateExpenseDto | typeof QueryExpenseDto,
  payload: unknown,
): Promise<string[]> {
  const dto = plainToInstance(dtoClass, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CreateExpenseDto', () => {
  const validPayload = {
    description: 'Palco principal',
    group: 'fixed',
    category: 'Estrutura',
    unitPrice: 1500.5,
  };

  it('aceita payload mínimo sem fornecedor e sem data aplicando padrões', async () => {
    const dto = plainToInstance(CreateExpenseDto, validPayload);

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.quantity).toBe(1);
    expect(dto.quoted).toBe(false);
  });

  it('aceita payload completo e limpa textos', async () => {
    const dto = plainToInstance(CreateExpenseDto, {
      ...validPayload,
      quantity: 2,
      supplierId: '11111111-1111-4111-8111-111111111111',
      dueDate: '2026-12-01T12:00:00.000Z',
      responsible: ' Ana ',
      quoted: true,
      notes: '  Incluir montagem  ',
      paymentStatus: 'pendente',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.responsible).toBe('Ana');
    expect(dto.notes).toBe('Incluir montagem');
    expect(dto.dueDate).toBeInstanceOf(Date);
  });

  it('recusa null em quantity, quoted e paymentStatus', async () => {
    for (const field of ['quantity', 'quoted', 'paymentStatus']) {
      const errors = await validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        [field]: null,
      });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('recusa grupo inválido e categoria vazia', async () => {
    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        group: 'outro',
      }),
    ).resolves.toContain('isIn');

    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        category: '   ',
      }),
    ).resolves.toContain('isNotEmpty');
  });

  it('recusa quantidade ou valor unitário negativo, com mais de 2 casas ou acima do limite', async () => {
    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        quantity: -1,
      }),
    ).resolves.toContain('min');

    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        unitPrice: 10.999,
      }),
    ).resolves.toContain('isNumber');

    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        quantity: MAX_EXPENSE_AMOUNT + 1,
      }),
    ).resolves.toContain('max');

    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        unitPrice: MAX_EXPENSE_AMOUNT + 1,
      }),
    ).resolves.toContain('max');
  });

  it('recusa dueDate numérico (como 0) e notes acima de 1000 caracteres', async () => {
    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        dueDate: 0,
      }),
    ).resolves.toContain('isDate');

    await expect(
      validationErrorsFor(CreateExpenseDto, {
        ...validPayload,
        notes: 'a'.repeat(1001),
      }),
    ).resolves.toContain('maxLength');
  });
});

describe('UpdateExpenseDto', () => {
  it('aceita atualização parcial só com quoted ou só com paymentStatus', async () => {
    await expect(
      validationErrorsFor(UpdateExpenseDto, { quoted: true }),
    ).resolves.toEqual([]);

    await expect(
      validationErrorsFor(UpdateExpenseDto, { paymentStatus: 'pago' }),
    ).resolves.toEqual([]);
  });

  it('aceita null nos campos opcionais para limpar valores gravados', async () => {
    const dto = plainToInstance(UpdateExpenseDto, {
      supplierId: null,
      dueDate: null,
      responsible: null,
      notes: null,
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.supplierId).toBeNull();
    expect(dto.dueDate).toBeNull();
    expect(dto.responsible).toBeNull();
    expect(dto.notes).toBeNull();
  });

  it('recusa null em campos obrigatórios no banco', async () => {
    for (const field of [
      'description',
      'group',
      'category',
      'quantity',
      'unitPrice',
      'quoted',
      'paymentStatus',
    ]) {
      const errors = await validationErrorsFor(UpdateExpenseDto, {
        [field]: null,
      });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('recusa dueDate numérico, notes > 1000 caracteres e valores acima do limite', async () => {
    await expect(
      validationErrorsFor(UpdateExpenseDto, { dueDate: 0 }),
    ).resolves.toContain('isDate');

    await expect(
      validationErrorsFor(UpdateExpenseDto, { notes: 'a'.repeat(1001) }),
    ).resolves.toContain('maxLength');

    await expect(
      validationErrorsFor(UpdateExpenseDto, {
        unitPrice: MAX_EXPENSE_AMOUNT + 1,
      }),
    ).resolves.toContain('max');
  });
});

describe('QueryExpenseDto', () => {
  it('converte quoted string para boolean e limpa category', async () => {
    const dto = plainToInstance(QueryExpenseDto, {
      group: 'variable',
      category: ' Open ',
      quoted: 'true',
      paymentStatus: 'pendente',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.group).toBe('variable');
    expect(dto.category).toBe('Open');
    expect(dto.quoted).toBe(true);
    expect(dto.paymentStatus).toBe('pendente');
  });

  it('recusa quoted diferente de boolean', async () => {
    await expect(
      validationErrorsFor(QueryExpenseDto, { quoted: 'talvez' }),
    ).resolves.toContain('isBoolean');
  });
});
