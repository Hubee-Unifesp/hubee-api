import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrganizationDto } from './update-organization.dto';

describe('UpdateOrganizationDto', () => {
  it('aceita campos omitidos', async () => {
    const dto = plainToInstance(UpdateOrganizationDto, {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([null, ' '])('rejeita name=%j', async (name) => {
    const dto = plainToInstance(UpdateOrganizationDto, { name });

    await expect(validate(dto)).resolves.toEqual([
      expect.objectContaining({
        property: 'name',
        constraints: expect.objectContaining({
          isNotEmpty: expect.any(String),
        }),
      }),
    ]);
  });
});
