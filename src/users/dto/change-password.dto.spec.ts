import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  it('aceita senha atual e nova senha válidas', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'antiga123',
      newPassword: 'nova12345',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejeita quando falta a senha atual', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      newPassword: 'nova12345',
    });
    const errors = await validate(dto);

    expect(errors).toEqual([
      expect.objectContaining({ property: 'currentPassword' }),
    ]);
  });

  it.each(['12345', 'x'.repeat(21)])(
    'rejeita newPassword fora de 6 a 20 caracteres (%#)',
    async (newPassword) => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'antiga123',
        newPassword,
      });
      const errors = await validate(dto);

      expect(errors).toEqual([
        expect.objectContaining({ property: 'newPassword' }),
      ]);
    },
  );
});
