import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMeDto } from './update-me.dto';

const options = { whitelist: true, forbidNonWhitelisted: true };

describe('UpdateMeDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateMeDto, {});

    await expect(validate(dto, options)).resolves.toEqual([]);
  });

  it('aceita os campos permitidos', async () => {
    const dto = plainToInstance(UpdateMeDto, {
      fullName: 'Maria Silva',
      email: 'maria@example.com',
      phone: '11999999999',
      birthDate: '1990-01-01',
    });

    await expect(validate(dto, options)).resolves.toEqual([]);
  });

  it('normaliza e-mail e remove espaços do nome', () => {
    const dto = plainToInstance(UpdateMeDto, {
      fullName: '  Maria Silva  ',
      email: ' MARIA@Example.COM ',
    });

    expect(dto.fullName).toBe('Maria Silva');
    expect(dto.email).toBe('maria@example.com');
  });

  it.each(['cpf', 'role', 'status', 'password', 'signupIntent'])(
    'rejeita o campo proibido %s',
    async (field) => {
      const dto = plainToInstance(UpdateMeDto, { [field]: 'x' });

      await expect(validate(dto, options)).resolves.toEqual([
        expect.objectContaining({
          property: field,
          constraints: expect.objectContaining({
            whitelistValidation: expect.any(String),
          }),
        }),
      ]);
    },
  );

  it.each([null, ' '])('rejeita fullName=%j', async (fullName) => {
    const dto = plainToInstance(UpdateMeDto, { fullName });
    const errors = await validate(dto, options);

    expect(errors).toEqual([expect.objectContaining({ property: 'fullName' })]);
  });
});
