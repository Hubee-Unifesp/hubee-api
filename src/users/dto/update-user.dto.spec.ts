import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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
});
