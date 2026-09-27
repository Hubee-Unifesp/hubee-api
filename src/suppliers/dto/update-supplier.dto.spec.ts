import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSupplierDto } from './update-supplier.dto';

describe('UpdateSupplierDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateSupplierDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([null, ' '])('rejeita companyName=%j', async (companyName) => {
    const dto = plainToInstance(UpdateSupplierDto, { companyName });

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
