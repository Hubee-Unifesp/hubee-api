import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateVenueDto } from './update-venue.dto';

describe('UpdateVenueDto', () => {
  it.each([null, [], [{ city: 'Recife' }], 'Recife'])(
    'rejeita address que não é objeto: %j',
    async (address) => {
      const dto = plainToInstance(UpdateVenueDto, { address });
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );

  it('valida os campos internos do endereço', async () => {
    const dto = plainToInstance(UpdateVenueDto, { address: { city: null } });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('allows an omitted name', async () => {
    const dto = plainToInstance(UpdateVenueDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([null, '   '])('rejects name=%j', async (name) => {
    const dto = plainToInstance(UpdateVenueDto, { name });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('allows a non-blank name', async () => {
    const dto = plainToInstance(UpdateVenueDto, { name: 'Local novo' });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
