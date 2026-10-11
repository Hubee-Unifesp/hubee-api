import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsCpf, isValidCpf } from './cpf';

class CpfDto {
  @IsCpf()
  cpf: unknown;
}

describe('isValidCpf', () => {
  it.each(['52998224725', '11144477735', '39053344705'])('aceita %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each([
    '52998224724',
    '52998224715',
    '11111111111',
    '00000000000',
    '5299822472',
    '529982247255',
    '529.982.247-25',
    '5299822472a',
    '',
    null,
    undefined,
    52998224725,
  ])('recusa %j', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});

describe('@IsCpf', () => {
  it('usa a mensagem padrão em português', async () => {
    const errors = await validate(
      plainToInstance(CpfDto, { cpf: '52998224724' }),
    );
    expect(errors[0].constraints).toEqual({ isCpf: 'CPF inválido' });
  });

  it('não gera erro para CPF válido', async () => {
    await expect(
      validate(plainToInstance(CpfDto, { cpf: '52998224725' })),
    ).resolves.toEqual([]);
  });
});
