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

  it.each([8, 28, 72])(
    'aceita senha com %d caracteres em CreateUserDto, UpdateUserDto e ChangePasswordDto',
    async (length) => {
      const password = 'a'.repeat(length);

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

  it.each([7, 73])(
    'rejeita senha com %d caracteres em CreateUserDto, UpdateUserDto e ChangePasswordDto',
    async (length) => {
      const password = 'a'.repeat(length);
      const expectedConstraint = {
        isLength: 'A senha deve ter entre 8 e 72 caracteres',
      };

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
