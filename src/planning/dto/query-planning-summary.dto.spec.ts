import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryPlanningSummaryDto } from './query-planning-summary.dto';

async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(QueryPlanningSummaryDto, query);
  const errors = await validate(dto);
  return {
    dto,
    errors: errors.flatMap((e) => Object.keys(e.constraints ?? {})),
  };
}

describe('QueryPlanningSummaryDto', () => {
  it('converte audience da query string para número', async () => {
    const { dto, errors } = await parse({ audience: '320' });
    expect(errors).toEqual([]);
    expect(dto.audience).toBe(320);
  });

  it('aceita a query sem audience', async () => {
    const { dto, errors } = await parse({});
    expect(errors).toEqual([]);
    expect(dto.audience).toBeUndefined();
  });

  it.each([
    ['0', 'min'],
    ['-10', 'min'],
    ['12.5', 'isInt'],
    ['abc', 'isInt'],
    ['10000001', 'max'],
  ])('recusa audience=%s (%s)', async (value, constraint) => {
    const { errors } = await parse({ audience: value });
    expect(errors).toContain(constraint);
  });
});
