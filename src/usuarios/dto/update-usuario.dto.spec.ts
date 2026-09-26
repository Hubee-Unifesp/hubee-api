import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUsuarioDto } from './update-usuario.dto';

describe('UpdateUsuarioDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateUsuarioDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([null, ' '])('rejeita firstName=%j', async (firstName) => {
    const dto = plainToInstance(UpdateUsuarioDto, { firstName });

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'firstName',
        constraints: expect.objectContaining({
          isNotEmpty: expect.any(String),
        }),
      }),
    ]);
  });
});
