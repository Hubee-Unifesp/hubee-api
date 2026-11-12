import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateUserDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([null, ' '])('rejeita fullName=%j', async (fullName) => {
    const dto = plainToInstance(UpdateUserDto, { fullName });

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'fullName',
        constraints: expect.objectContaining({
          isNotEmpty: expect.any(String),
        }),
      }),
    ]);
  });

  it.each(['a'.repeat(8), 'a'.repeat(28), 'a'.repeat(72), 'á'.repeat(36)])(
    'aceita senha válida (%s) em CreateUserDto, UpdateUserDto e ChangePasswordDto',
    async (password) => {
      const createDto = plainToInstance(CreateUserDto, {
        fullName: 'Maria Silva',
        email: 'maria@example.com',
        password,
      });
      const updateDto = plainToInstance(UpdateUserDto, { password });
      const changePasswordDto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'oldPassword1',
        newPassword: password,
      });

      await expect(validate(createDto)).resolves.toEqual([]);
      await expect(validate(updateDto)).resolves.toEqual([]);
      await expect(validate(changePasswordDto)).resolves.toEqual([]);
    },
  );

  it.each([
    [
      'a'.repeat(7),
      { minLength: 'A senha deve ter no mínimo 8 caracteres' },
    ],
    [
      'a'.repeat(73),
      {
        maxByteLength:
          'A senha deve ter no máximo 72 bytes (caracteres acentuados e emojis contam mais de um)',
      },
    ],
    [
      `${'a'.repeat(71)}á`,
      {
        maxByteLength:
          'A senha deve ter no máximo 72 bytes (caracteres acentuados e emojis contam mais de um)',
      },
    ],
    [
      'á'.repeat(37),
      {
        maxByteLength:
          'A senha deve ter no máximo 72 bytes (caracteres acentuados e emojis contam mais de um)',
      },
    ],
  ])(
    'rejeita senha inválida (%s) em CreateUserDto, UpdateUserDto e ChangePasswordDto',
    async (password, expectedConstraint) => {
      const createDto = plainToInstance(CreateUserDto, {
        fullName: 'Maria Silva',
        email: 'maria@example.com',
        password,
      });
      const updateDto = plainToInstance(UpdateUserDto, { password });
      const changePasswordDto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'oldPassword1',
        newPassword: password,
      });

      await expect(validate(createDto)).resolves.toEqual([
        expect.objectContaining({
          property: 'password',
          constraints: expect.objectContaining(expectedConstraint),
        }),
      ]);
      await expect(validate(updateDto)).resolves.toEqual([
        expect.objectContaining({
          property: 'password',
          constraints: expect.objectContaining(expectedConstraint),
        }),
      ]);
      await expect(validate(changePasswordDto)).resolves.toEqual([
        expect.objectContaining({
          property: 'newPassword',
          constraints: expect.objectContaining(expectedConstraint),
        }),
      ]);
    },
  );
});
