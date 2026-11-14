import { ValidateBy, ValidationOptions } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export function hasMaxByteLength(value: unknown, maxBytes: number): boolean {
  if (typeof value !== 'string') return false;
  return Buffer.byteLength(value, 'utf8') <= maxBytes;
}

export function MaxByteLength(
  maxBytes: number,
  validationOptions?: ValidationOptions,
) {
  return ValidateBy(
    {
      name: 'maxByteLength',
      constraints: [maxBytes],
      validator: {
        validate: (value) => hasMaxByteLength(value, maxBytes),
      },
    },
    {
      message: `A senha deve ter no máximo ${maxBytes} bytes (caracteres acentuados e emojis contam mais de um)`,
      ...validationOptions,
    },
  );
}
