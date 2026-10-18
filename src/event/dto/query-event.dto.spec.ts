import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, QueryEventDto } from './query-event.dto';

function toDto(query: Record<string, string>) {
  return plainToInstance(QueryEventDto, query);
}

async function invalidFields(query: Record<string, string>) {
  const errors = await validate(toDto(query));
  return errors.map((error) => error.property);
}

describe('QueryEventDto', () => {
  it('aceita query vazia e aplica a paginação padrão', async () => {
    const dto = toDto({});

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.page).toBe(DEFAULT_PAGE);
    expect(dto.limit).toBe(DEFAULT_LIMIT);
  });

  it('aceita todos os filtros combinados e converte os tipos', async () => {
    const dto = toDto({
      search: '  festa  ',
      category: 'shows',
      city: 'São Paulo',
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-31T23:59:59.000Z',
      page: '2',
      limit: '10',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toMatchObject({
      search: 'festa',
      category: 'shows',
      city: 'São Paulo',
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T23:59:59.000Z'),
      page: 2,
      limit: 10,
    });
  });

  it('data só com o dia cobre o dia inteiro no horário de Brasília', () => {
    const dto = toDto({ startDate: '2026-10-20', endDate: '2026-10-20' });

    expect(dto.startDate).toEqual(new Date('2026-10-20T03:00:00.000Z'));
    expect(dto.endDate).toEqual(new Date('2026-10-21T02:59:59.999Z'));
  });

  it.each([
    ['startDate', { startDate: '2026-13-45' }],
    ['startDate', { startDate: 'ontem' }],
    ['endDate', { endDate: 'não-é-data' }],
    ['page', { page: 'abc' }],
    ['page', { page: '0' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: 'dez' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: '101' }],
    ['search', { search: '   ' }],
    ['city', { city: '' }],
    ['category', { category: '' }],
  ])('recusa %s inválido (%j)', async (field, query) => {
    await expect(invalidFields(query)).resolves.toEqual([field]);
  });
});
