import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSupplierReviewDto } from './create-supplier-review.dto';

function toDto(body: Record<string, unknown>) {
  return plainToInstance(CreateSupplierReviewDto, body);
}

async function messages(body: Record<string, unknown>) {
  const errors = await validate(toDto(body));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('CreateSupplierReviewDto', () => {
  it.each([1, 3, 5])(
    'aceita nota inteira %p sem comentário',
    async (rating) => {
      await expect(messages({ rating })).resolves.toEqual([]);
    },
  );

  it('aceita comentário e remove espaços das pontas', async () => {
    const dto = toDto({ rating: 4, comment: '  Muito bom.  ' });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.comment).toBe('Muito bom.');
  });

  it('exige a nota', async () => {
    await expect(messages({})).resolves.toContain('A nota é obrigatória.');
  });

  it.each([0, 6, -1])('rejeita nota fora de 1 a 5 (%p)', async (rating) => {
    await expect(messages({ rating })).resolves.toContain(
      'A nota deve ser entre 1 e 5.',
    );
  });

  it.each([4.5, '4'])('rejeita nota não inteira (%p)', async (rating) => {
    await expect(messages({ rating })).resolves.toContain(
      'A nota deve ser um número inteiro.',
    );
  });

  it('rejeita comentário com mais de 500 caracteres', async () => {
    await expect(
      messages({ rating: 5, comment: 'a'.repeat(501) }),
    ).resolves.toEqual(['O comentário deve ter no máximo 500 caracteres.']);
    await expect(
      messages({ rating: 5, comment: 'a'.repeat(500) }),
    ).resolves.toEqual([]);
  });

  it('rejeita comentário que não é texto', async () => {
    await expect(messages({ rating: 5, comment: 42 })).resolves.toContain(
      'O comentário deve ser um texto.',
    );
  });
});
