import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuerySupplierDto } from './query-supplier.dto';

function toDto(query: Record<string, unknown>) {
  return plainToInstance(QuerySupplierDto, query);
}

async function invalidFields(query: Record<string, unknown>) {
  const errors = await validate(toDto(query));
  return errors.map((error) => error.property);
}

describe('QuerySupplierDto', () => {
  it('aceita query vazia', async () => {
    const dto = toDto({});

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.search).toBeUndefined();
    expect(dto.category).toBeUndefined();
    expect(dto.minRating).toBeUndefined();
    expect(dto.sortBy).toBeUndefined();
  });

  it('aceita search, category, minRating e sortBy com normalização', async () => {
    const dto = toDto({
      search: '  Som & Luz  ',
      category: '  Buffet  ',
      minRating: ' 4.5 ',
      sortBy: '  rating  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toEqual({
      search: 'Som & Luz',
      category: 'Buffet',
      minRating: 4.5,
      sortBy: 'rating',
    });
  });

  it.each(['rating', 'companyName', 'createdAt'] as const)(
    'aceita sortBy=%s',
    async (sortBy) => {
      const dto = toDto({ sortBy });
      await expect(validate(dto)).resolves.toEqual([]);
      expect(dto.sortBy).toBe(sortBy);
    },
  );

  it.each([1, 3, 4.5, 5, '1', '4', '5'])(
    'aceita minRating=%p entre 1 e 5',
    async (minRating) => {
      const dto = toDto({ minRating });
      await expect(validate(dto)).resolves.toEqual([]);
      expect(dto.minRating).toBe(Number(minRating));
    },
  );

  it.each([
    ['search', { search: '' }],
    ['search', { search: '   ' }],
    ['search', { search: 'a'.repeat(256) }],
    ['category', { category: '' }],
    ['category', { category: '   ' }],
    ['category', { category: 'a'.repeat(101) }],
    ['minRating', { minRating: '' }],
    ['minRating', { minRating: '   ' }],
    ['minRating', { minRating: 'abc' }],
    ['minRating', { minRating: '0' }],
    ['minRating', { minRating: 0 }],
    ['minRating', { minRating: 0.9 }],
    ['minRating', { minRating: 5.1 }],
    ['minRating', { minRating: 6 }],
    ['sortBy', { sortBy: '' }],
    ['sortBy', { sortBy: '   ' }],
    ['sortBy', { sortBy: 'name' }],
    ['sortBy', { sortBy: 'invalid' }],
  ])('recusa %s inválido (%j)', async (field, query) => {
    await expect(invalidFields(query)).resolves.toEqual([field]);
  });
});
