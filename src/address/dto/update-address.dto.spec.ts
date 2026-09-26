import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAddressDto } from './update-address.dto';

describe('UpdateAddressDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateAddressDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([null, ' '])('rejeita city=%j', async (city) => {
    const dto = plainToInstance(UpdateAddressDto, { city });

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'city',
        constraints: expect.objectContaining({
          isNotEmpty: expect.any(String),
        }),
      }),
    ]);
  });
});
