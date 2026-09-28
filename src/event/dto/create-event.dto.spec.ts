import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

async function validationErrorsFor(payload: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateEventDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('CreateEventDto', () => {
  const organizerId = '3f1a6f1e-0b6a-4d4a-9c2e-8e4a1d5b9c77';
  const venueId = '7b2c8d9e-1a3f-4b5c-8d7e-9f0a1b2c3d4e';

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Festa Junina 2026',
      organizerId,
      venueId,
      startDate: '2026-06-20T18:00:00.000Z',
      endDate: '2026-06-20T23:00:00.000Z',
      ...overrides,
    };
  }

  it('aceita um payload mínimo válido', async () => {
    await expect(validationErrorsFor(validPayload())).resolves.toEqual([]);
  });

  it('aceita um payload completo', async () => {
    await expect(
      validationErrorsFor(
        validPayload({
          description: 'A tradicional festa junina da agremiação',
          ageRating: '12',
          salesStartDate: '2026-05-01T12:00:00.000Z',
          category: 'festa',
          edition: '3ª edição',
          photoUrl: 'https://cdn.hubee.com.br/eventos/festa-junina.jpg',
        }),
      ),
    ).resolves.toEqual([]);
  });

  it('recusa payload sem nome', async () => {
    const { name: _name, ...payload } = validPayload();
    await expect(validationErrorsFor(payload)).resolves.toContain('isString');
  });

  it('recusa nome acima de 255 caracteres', async () => {
    await expect(
      validationErrorsFor(validPayload({ name: 'a'.repeat(256) })),
    ).resolves.toContain('maxLength');
  });

  it('recusa organizador que não é uuid', async () => {
    await expect(
      validationErrorsFor(validPayload({ organizerId: 'abc' })),
    ).resolves.toContain('isUuid');
  });

  it('recusa local que não é uuid', async () => {
    await expect(
      validationErrorsFor(validPayload({ venueId: 'abc' })),
    ).resolves.toContain('isUuid');
  });

  it('recusa payload sem data de início', async () => {
    const { startDate: _startDate, ...payload } = validPayload();
    await expect(validationErrorsFor(payload)).resolves.toContain('isDate');
  });

  it('recusa data que não é uma data válida', async () => {
    await expect(
      validationErrorsFor(validPayload({ endDate: 'ontem' })),
    ).resolves.toContain('isDate');
  });

  it('recusa classificação indicativa fora da lista', async () => {
    await expect(
      validationErrorsFor(validPayload({ ageRating: '13' })),
    ).resolves.toContain('isIn');
  });

  it('recusa foto que não é uma url', async () => {
    await expect(
      validationErrorsFor(validPayload({ photoUrl: 'nao-e-url' })),
    ).resolves.toContain('isUrl');
  });
});
