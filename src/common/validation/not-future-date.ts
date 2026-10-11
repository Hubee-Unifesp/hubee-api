import { ValidateBy, ValidationOptions } from 'class-validator';

export function isNotFutureDate(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const today = new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0] <= today;
}

export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isNotFutureDate',
      validator: { validate: (value) => isNotFutureDate(value) },
    },
    { message: 'A data não pode estar no futuro', ...validationOptions },
  );
}
