import { type ClassConstructor, plainToInstance } from 'class-transformer';

/**
 * Converte o retorno do service (linha do banco) na instância do
 * `*ResponseDto` do recurso. Só os campos marcados com `@Expose()` no DTO
 * saem na resposta, então campos internos (`password`, `deletedAt`, ...)
 * nunca vazam, e a resposta real fica igual ao schema documentado no OpenAPI.
 */
export function toResponse<T>(dto: ClassConstructor<T>, data: object[]): T[];
export function toResponse<T>(dto: ClassConstructor<T>, data: object): T;
export function toResponse<T>(
  dto: ClassConstructor<T>,
  data: object | object[],
): T | T[] {
  return plainToInstance(dto, data, { excludeExtraneousValues: true });
}
