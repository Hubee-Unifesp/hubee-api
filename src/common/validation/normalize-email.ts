import { Transform } from 'class-transformer';

export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export function NormalizeEmail() {
  return Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
}
