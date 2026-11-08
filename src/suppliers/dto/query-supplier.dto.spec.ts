import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuerySupplierDto } from './query-supplier.dto';

function toDto(query: Record<string, string>) {
  return plainToInstance(QuerySupplierDto, query);
}

async function invalidFields(query: Record<string, string>) {
  const errors = await validate(toDto(query));
  return errors.map((error) => error.property);
}

describe('QuerySupplierDto', () => {
  it('aceita query vazia', async () => {
    const dto = toDto({});

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.search).toBeUndefined();
    expect(dto.category).toBeUndefined();
  });

  it('aceita search e category com trim de espaços', async () => {
    const dto = toDto({
      search: '  Som & Luz  ',
      category: '  Buffet  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toEqual({
      search: 'Som & Luz',
      category: 'Buffet',
    });
  });

  it.each([
    ['search', { search: '' }],
    ['search', { search: '   ' }],
    ['search', { search: 'a'.repeat(256) }],
    ['category', { category: '' }],
    ['category', { category: '   ' }],
    ['category', { category: 'a'.repeat(101) }],
  ])('recusa %s inválido (%j)', async (field, query) => {
    await expect(invalidFields(query)).resolves.toEqual([field]);
  });
});
