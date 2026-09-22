import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationEventDto } from './create-organization-event.dto';

async function validationErrorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateOrganizationEventDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CreateOrganizationEventDto', () => {
  const organizationId = '3f1a6f1e-0b6a-4d4a-9c2e-8e4a1d5b9c77';

  it('aceita um payload válido', async () => {
    await expect(
      validationErrorsFor({ organizationId, role: 'main' }),
    ).resolves.toEqual([]);
  });

  it('aceita todos os papéis previstos', async () => {
    for (const role of ['main', 'co_organizer', 'supporter']) {
      await expect(
        validationErrorsFor({ organizationId, role }),
      ).resolves.toEqual([]);
    }
  });

  it('recusa payload sem organização', async () => {
    await expect(validationErrorsFor({ role: 'main' })).resolves.toContain(
      'isUuid',
    );
  });

  it('recusa organização que não é uuid', async () => {
    await expect(
      validationErrorsFor({ organizationId: 'abc', role: 'main' }),
    ).resolves.toContain('isUuid');
  });

  it('recusa payload sem papel', async () => {
    await expect(validationErrorsFor({ organizationId })).resolves.toContain(
      'isIn',
    );
  });

  it('recusa papel fora da lista', async () => {
    await expect(
      validationErrorsFor({ organizationId, role: 'patrocinadora' }),
    ).resolves.toContain('isIn');
  });
});
