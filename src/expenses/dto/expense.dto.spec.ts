import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';
import { QueryExpenseDto } from './query-expense.dto';
import { UpdateExpenseDto } from './update-expense.dto';

async function validateDto<T extends object>(
  dtoClass: new () => T,
  payload: unknown,
): Promise<{ dto: T; constraints: string[] }> {
  const dto = plainToInstance(dtoClass, payload);
  const errors = await validate(dto);
  const constraints = errors.flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
  return { dto, constraints };
}

describe('CreateExpenseDto', () => {
  const validPayload = {
    description: 'Palco principal',
    group: 'fixed',
    category: 'Estrutura',
    unitPrice: 1500.5,
  };

  it('aceita payload mínimo sem fornecedor e sem data aplicando padrões', async () => {
    const { dto, constraints } = await validateDto(
      CreateExpenseDto,
      validPayload,
    );

    expect(constraints).toEqual([]);
    expect(dto.quantity).toBe(1);
    expect(dto.quoted).toBe(false);
  });

  it('aceita payload completo com fornecedor, data, quantidade, responsável e notas', async () => {
    const { dto, constraints } = await validateDto(CreateExpenseDto, {
      ...validPayload,
      quantity: 2,
      supplierId: '11111111-1111-4111-8111-111111111111',
      dueDate: '2026-12-01T12:00:00.000Z',
      responsible: ' Ana ',
      quoted: true,
      notes: '  Incluir montagem  ',
      paymentStatus: 'pendente',
    });

    expect(constraints).toEqual([]);
    expect(dto.responsible).toBe('Ana');
    expect(dto.notes).toBe('Incluir montagem');
    expect(dto.dueDate).toBeInstanceOf(Date);
  });

  it('recusa grupo inválido e categoria vazia', async () => {
    const { constraints: groupErrors } = await validateDto(CreateExpenseDto, {
      ...validPayload,
      group: 'outro',
    });
    expect(groupErrors).toContain('isIn');

    const { constraints: catErrors } = await validateDto(CreateExpenseDto, {
      ...validPayload,
      category: '   ',
    });
    expect(catErrors).toContain('isNotEmpty');
  });

  it('recusa quantidade ou valor unitário negativo ou com mais de 2 casas decimais', async () => {
    const { constraints: negQty } = await validateDto(CreateExpenseDto, {
      ...validPayload,
      quantity: -1,
    });
    expect(negQty).toContain('min');

    const { constraints: decPrice } = await validateDto(CreateExpenseDto, {
      ...validPayload,
      unitPrice: 10.999,
    });
    expect(decPrice).toContain('isNumber');
  });
});

describe('UpdateExpenseDto', () => {
  it('aceita atualização parcial só com quoted ou só com paymentStatus', async () => {
    await expect(
      validateDto(UpdateExpenseDto, { quoted: true }),
    ).resolves.toMatchObject({ constraints: [] });

    await expect(
      validateDto(UpdateExpenseDto, { paymentStatus: 'pago' }),
    ).resolves.toMatchObject({ constraints: [] });
  });

  it('aceita null nos campos opcionais para limpar valores gravados', async () => {
    const { dto, constraints } = await validateDto(UpdateExpenseDto, {
      supplierId: null,
      dueDate: null,
      responsible: null,
      notes: null,
    });

    expect(constraints).toEqual([]);
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
      const { constraints } = await validateDto(UpdateExpenseDto, {
        [field]: null,
      });
      expect(constraints.length).toBeGreaterThan(0);
    }
  });
});

describe('QueryExpenseDto', () => {
  it('converte quoted string para boolean e limpa category', async () => {
    const { dto, constraints } = await validateDto(QueryExpenseDto, {
      group: 'variable',
      category: ' Open ',
      quoted: 'true',
      paymentStatus: 'pendente',
    });

    expect(constraints).toEqual([]);
    expect(dto.group).toBe('variable');
    expect(dto.category).toBe('Open');
    expect(dto.quoted).toBe(true);
    expect(dto.paymentStatus).toBe('pendente');
  });

  it('recusa quoted diferente de boolean', async () => {
    const { constraints } = await validateDto(QueryExpenseDto, {
      quoted: 'talvez',
    });
    expect(constraints).toContain('isBoolean');
  });
});
