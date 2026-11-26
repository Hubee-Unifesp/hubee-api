import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, validate } from 'class-validator';
import { IsOptionalUpdate, ToDate, TrimString } from './update-validation';

class OptionalUpdateDto {
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  value?: string;
}

class TrimStringDto {
  @TrimString()
  value: unknown;
}

class ToDateDto {
  @ToDate()
  value: unknown;
}

describe('IsOptionalUpdate', () => {
  it('ignora valores undefined', async () => {
    const dto = plainToInstance(OptionalUpdateDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('valida null em vez de ignorá-lo', async () => {
    const dto = plainToInstance(OptionalUpdateDto, { value: null });

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'value',
        constraints: expect.objectContaining({ isString: expect.any(String) }),
      }),
    ]);
  });

  it('não transforma espaços em branco', async () => {
    const dto = plainToInstance(OptionalUpdateDto, { value: ' ' });

    expect(dto.value).toBe(' ');
    await expect(validate(dto)).resolves.toEqual([]);
  });
});

describe('TrimString', () => {
  it.each([
    [null, null],
    [' ', ''],
    ['  Maria Silva  ', 'Maria Silva'],
    [42, 42],
  ])('transforma %j em %j', (value, expected) => {
    const dto = plainToInstance(TrimStringDto, { value });

    expect(dto.value).toBe(expected);
  });
});

describe('ToDate', () => {
  it('converte string ISO em Date e preserva null, undefined e números', () => {
    expect(
      plainToInstance(ToDateDto, { value: '2026-12-01T12:00:00.000Z' }).value,
    ).toBeInstanceOf(Date);
    expect(plainToInstance(ToDateDto, { value: null }).value).toBeNull();
    expect(
      plainToInstance(ToDateDto, { value: undefined }).value,
    ).toBeUndefined();
    expect(plainToInstance(ToDateDto, { value: 0 }).value).toBe(0);
  });
});
