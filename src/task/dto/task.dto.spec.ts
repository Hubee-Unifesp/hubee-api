import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

/**
 * As regras de payload vivem nos decorators do DTO e são aplicadas pelo
 * ValidationPipe, que só roda numa requisição HTTP. Estes testes chamam o
 * class-validator direto para cobrir os valores inválidos sem subir a app.
 */
async function validationErrorsFor(
  dtoClass: typeof CreateTaskDto | typeof UpdateTaskDto,
  payload: unknown,
): Promise<string[]> {
  const dto = plainToInstance(dtoClass, payload);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

const validUserId = '3f1a6f1e-0b6a-4d4a-9c2e-8e4a1d5b9c77';

describe('CreateTaskDto', () => {
  const validPayload = {
    responsibleUserId: validUserId,
    title: 'Contratar buffet',
  };

  it('aceita um payload mínimo válido', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, validPayload),
    ).resolves.toEqual([]);
  });

  it('aceita um payload completo, convertendo o prazo para Date', async () => {
    const payload = {
      ...validPayload,
      description: 'Fechar cardápio com 3 opções',
      dueDate: '2026-06-01T12:00:00Z',
      status: 'in_progress',
    };

    await expect(validationErrorsFor(CreateTaskDto, payload)).resolves.toEqual(
      [],
    );
    expect(plainToInstance(CreateTaskDto, payload).dueDate).toBeInstanceOf(
      Date,
    );
  });

  it('recusa payload sem responsável', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, { title: 'Contratar buffet' }),
    ).resolves.toContain('isUuid');
  });

  it('recusa responsável que não é uuid', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, {
        ...validPayload,
        responsibleUserId: 'abc',
      }),
    ).resolves.toContain('isUuid');
  });

  it('recusa payload sem título', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, { responsibleUserId: validUserId }),
    ).resolves.toContain('isString');
  });

  it('recusa título vazio', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, { ...validPayload, title: '' }),
    ).resolves.toContain('isNotEmpty');
  });

  it('recusa título com mais de 255 caracteres', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, {
        ...validPayload,
        title: 'a'.repeat(256),
      }),
    ).resolves.toContain('maxLength');
  });

  it('recusa prazo que não é data', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, {
        ...validPayload,
        dueDate: 'amanhã',
      }),
    ).resolves.toContain('isDate');
  });

  it('recusa status fora da lista', async () => {
    await expect(
      validationErrorsFor(CreateTaskDto, {
        ...validPayload,
        status: 'archived',
      }),
    ).resolves.toContain('isIn');
  });
});

describe('UpdateTaskDto', () => {
  it('aceita payload vazio', async () => {
    await expect(validationErrorsFor(UpdateTaskDto, {})).resolves.toEqual([]);
  });

  it('aceita troca de status', async () => {
    await expect(
      validationErrorsFor(UpdateTaskDto, { status: 'done' }),
    ).resolves.toEqual([]);
  });

  it('aceita null para limpar descrição e prazo', async () => {
    await expect(
      validationErrorsFor(UpdateTaskDto, { description: null, dueDate: null }),
    ).resolves.toEqual([]);
  });

  it.each(['title', 'status', 'responsibleUserId'])(
    'recusa null em %s, que é obrigatório no banco',
    async (field) => {
      await expect(
        validationErrorsFor(UpdateTaskDto, { [field]: null }),
      ).resolves.not.toEqual([]);
    },
  );

  it('recusa título vazio', async () => {
    await expect(
      validationErrorsFor(UpdateTaskDto, { title: '' }),
    ).resolves.toContain('isNotEmpty');
  });

  it('recusa status fora da lista', async () => {
    await expect(
      validationErrorsFor(UpdateTaskDto, { status: 'archived' }),
    ).resolves.toContain('isIn');
  });
});
