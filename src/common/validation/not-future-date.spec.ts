import { afterEach, beforeEach, jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsNotFutureDate, isNotFutureDate } from './not-future-date';

class DateDto {
  @IsNotFutureDate()
  date: unknown;
}

describe('isNotFutureDate', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['1990-01-01', '2026-10-04', '2026-10-05', '2026-10-05T23:00:00Z'])(
    'aceita %s',
    (date) => {
      expect(isNotFutureDate(date)).toBe(true);
    },
  );

  it.each(['2026-10-06', '2030-01-01', '2026-10-06T00:00:00Z'])(
    'recusa %s',
    (date) => {
      expect(isNotFutureDate(date)).toBe(false);
    },
  );

  it('deixa valores que não são datas para outros validadores', () => {
    expect(isNotFutureDate('not-a-date')).toBe(true);
    expect(isNotFutureDate(42)).toBe(true);
  });

  it('usa a mensagem padrão em português', async () => {
    const errors = await validate(
      plainToInstance(DateDto, { date: '2030-01-01' }),
    );
    expect(errors[0].constraints).toEqual({
      isNotFutureDate: 'A data não pode estar no futuro',
    });
  });
});
