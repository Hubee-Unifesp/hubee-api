import { ValidateBy, ValidationOptions } from 'class-validator';

function checkDigit(digits: string): number {
  const sum = [...digits].reduce(
    (acc, digit, index) => acc + Number(digit) * (digits.length + 1 - index),
    0,
  );
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isValidCpf(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{11}$/.test(value)) return false;
  if (/^(\d)\1{10}$/.test(value)) return false;
  return (
    checkDigit(value.slice(0, 9)) === Number(value[9]) &&
    checkDigit(value.slice(0, 10)) === Number(value[10])
  );
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isCpf',
      validator: { validate: (value) => isValidCpf(value) },
    },
    { message: 'CPF inválido', ...validationOptions },
  );
}
