import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

export function IsOptionalUpdate() {
  return ValidateIf((_object, value) => value !== undefined);
}

export function TrimString() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}