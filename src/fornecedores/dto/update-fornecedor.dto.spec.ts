import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateFornecedorDto } from './update-fornecedor.dto';

describe('UpdateFornecedorDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateFornecedorDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([null, ' '])('rejeita companyName=%j', async (companyName) => {
    const dto = plainToInstance(UpdateFornecedorDto, { companyName });

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'companyName',
        constraints: expect.objectContaining({
          isNotEmpty: expect.any(String),
        }),
      }),
    ]);
  });
});
