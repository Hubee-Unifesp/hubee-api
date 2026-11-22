import { describe, expect, it, jest } from '@jest/globals';
import {
  consumeRateLimit,
  type RateLimitStore,
} from './fixed-window-rate-limit';

const OPTIONS = { limit: 2, windowMs: 60_000 };
const NOW = 1_000_000;

describe('consumeRateLimit', () => {
  it('libera até o limite e bloqueia a chamada seguinte', () => {
    const store: RateLimitStore = new Map();

    expect(consumeRateLimit(store, 'k', OPTIONS, NOW).allowed).toBe(true);
    expect(consumeRateLimit(store, 'k', OPTIONS, NOW).allowed).toBe(true);
    expect(consumeRateLimit(store, 'k', OPTIONS, NOW).allowed).toBe(false);
  });

  it('informa os segundos que faltam para a janela reiniciar', () => {
    const store: RateLimitStore = new Map();
    consumeRateLimit(store, 'k', OPTIONS, NOW);

    expect(
      consumeRateLimit(store, 'k', OPTIONS, NOW + 15_500).retryAfterSeconds,
    ).toBe(45);
    expect(
      consumeRateLimit(store, 'k', OPTIONS, NOW + 59_999).retryAfterSeconds,
    ).toBe(1);
  });

  it('conta cada chave separadamente', () => {
    const store: RateLimitStore = new Map();
    consumeRateLimit(store, 'a', OPTIONS, NOW);
    consumeRateLimit(store, 'a', OPTIONS, NOW);

    expect(consumeRateLimit(store, 'a', OPTIONS, NOW).allowed).toBe(false);
    expect(consumeRateLimit(store, 'b', OPTIONS, NOW).allowed).toBe(true);
  });

  it('reinicia a contagem e remove chaves vencidas depois da janela', () => {
    const store: RateLimitStore = new Map();
    consumeRateLimit(store, 'a', OPTIONS, NOW);
    consumeRateLimit(store, 'a', OPTIONS, NOW);
    consumeRateLimit(store, 'a', OPTIONS, NOW);
    consumeRateLimit(store, 'b', OPTIONS, NOW);

    const later = NOW + OPTIONS.windowMs;
    expect(consumeRateLimit(store, 'a', OPTIONS, later).allowed).toBe(true);
    expect(store.has('b')).toBe(false);
    expect(store.get('a')?.count).toBe(1);
  });

  it('remove a entrada quando o timer da janela expira', () => {
    jest.useFakeTimers();
    try {
      const store: RateLimitStore = new Map();
      consumeRateLimit(store, 'k', OPTIONS);

      jest.advanceTimersByTime(OPTIONS.windowMs);

      expect(store.has('k')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
