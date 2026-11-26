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

  it('aceita photoUrl=null e cores hexadecimais válidas (ou null)', async () => {
    const dto = plainToInstance(UpdateOrganizationDto, {
      photoUrl: null,
      titleColor: '#FFFDF5',
      descriptionColor: null,
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejeita photoUrl com string em vez de null com mensagem em português', async () => {
    const dto = plainToInstance(UpdateOrganizationDto, {
      photoUrl: 'https://cdn.example.com/organizations/org-1/cover.png',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('photoUrl');
    expect(errors[0].constraints?.equals).toContain(
      'PATCH /organizations/:id/photo',
    );
  });

  it('rejeita titleColor e descriptionColor fora do padrão hexadecimal com mensagem em português', async () => {
    const dto = plainToInstance(UpdateOrganizationDto, {
      titleColor: 'azul',
      descriptionColor: '#123',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(2);
    expect(errors[0].constraints?.matches).toContain(
      'formato hexadecimal #RRGGBB',
    );
    expect(errors[1].constraints?.matches).toContain(
      'formato hexadecimal #RRGGBB',
    );
  });
});
