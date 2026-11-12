import { describe, expect, it } from '@jest/globals';
import { hasMaxByteLength, PASSWORD_MAX_BYTES } from './max-byte-length';

describe('hasMaxByteLength', () => {
  it('aceita string ASCII até 72 bytes', () => {
    expect(hasMaxByteLength('a'.repeat(72), PASSWORD_MAX_BYTES)).toBe(true);
    expect(hasMaxByteLength('a'.repeat(73), PASSWORD_MAX_BYTES)).toBe(false);
  });

  it('conta corretamente bytes UTF-8 de caracteres acentuados e emojis', () => {
    // 36 caracteres acentuados = 72 bytes UTF-8
    expect(hasMaxByteLength('á'.repeat(36), PASSWORD_MAX_BYTES)).toBe(true);
    // 37 caracteres acentuados = 74 bytes UTF-8 (mesmo tendo < 72 caracteres)
    expect(hasMaxByteLength('á'.repeat(37), PASSWORD_MAX_BYTES)).toBe(false);
    // 71 ASCII + 1 acentuado = 72 caracteres, mas 73 bytes UTF-8
    expect(hasMaxByteLength(`${'a'.repeat(71)}á`, PASSWORD_MAX_BYTES)).toBe(
      false,
    );
    // 18 emojis de 4 bytes = 72 bytes UTF-8
    expect(hasMaxByteLength('😀'.repeat(18), PASSWORD_MAX_BYTES)).toBe(true);
    // 19 emojis de 4 bytes = 76 bytes UTF-8
    expect(hasMaxByteLength('😀'.repeat(19), PASSWORD_MAX_BYTES)).toBe(false);
  });

  it('rejeita valores que não são string', () => {
    expect(hasMaxByteLength(null, PASSWORD_MAX_BYTES)).toBe(false);
    expect(hasMaxByteLength(12345678, PASSWORD_MAX_BYTES)).toBe(false);
  });
});
