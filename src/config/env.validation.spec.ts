import { describe, expect, it } from '@jest/globals';
import { validateEnv } from './env.validation';

const BASE = {
  DB_HOST: 'localhost',
  DB_USER: 'hubee',
  DB_PASSWORD: 'hubee',
  DB_NAME: 'hubee',
  JWT_SECRET: 'segredo',
};

describe('validateEnv - IA', () => {
  it('sobe sem chave da Anthropic e aplica padrões', () => {
    const env = validateEnv(BASE);

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBe('claude-opus-5-5');
    expect(env.AI_TIMEOUT_MS).toBe(30000);
    expect(env.AI_MAX_TOKENS).toBe(16000);
    expect(env.AI_EFFORT).toBe('medium');
    expect(env.AI_RATE_LIMIT_MAX).toBe(5);
    expect(env.AI_RATE_LIMIT_WINDOW_MS).toBe(60000);
  });

  it('lê os limites de uso e custo da IA informados', () => {
    const env = validateEnv({
      ...BASE,
      AI_MAX_TOKENS: '8000',
      AI_EFFORT: ' high ',
      AI_RATE_LIMIT_MAX: '3',
      AI_RATE_LIMIT_WINDOW_MS: '120000',
    });

    expect(env.AI_MAX_TOKENS).toBe(8000);
    expect(env.AI_EFFORT).toBe('high');
    expect(env.AI_RATE_LIMIT_MAX).toBe(3);
    expect(env.AI_RATE_LIMIT_WINDOW_MS).toBe(120000);
  });

  it.each([
    ['AI_MAX_TOKENS', '0'],
    ['AI_MAX_TOKENS', '1.5'],
    ['AI_RATE_LIMIT_MAX', '-1'],
    ['AI_RATE_LIMIT_WINDOW_MS', 'abc'],
    ['AI_EFFORT', 'ultra'],
    ['AI_EFFORT', 'HIGH'],
  ])('rejeita %s inválido (%s)', (key, value) => {
    expect(() => validateEnv({ ...BASE, [key]: value })).toThrow(key);
  });

  it('lê chave, modelo e timeout informados', () => {
    const env = validateEnv({
      ...BASE,
      ANTHROPIC_API_KEY: ' sk-ant-test ',
      ANTHROPIC_MODEL: 'claude-haiku-5-5',
      AI_TIMEOUT_MS: '15000',
    });

    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-test');
    expect(env.ANTHROPIC_MODEL).toBe('claude-haiku-5-5');
    expect(env.AI_TIMEOUT_MS).toBe(15000);
  });

  it.each(['0', '-1', '1.5', 'abc'])(
    'rejeita AI_TIMEOUT_MS inválido (%s)',
    (value) => {
      expect(() => validateEnv({ ...BASE, AI_TIMEOUT_MS: value })).toThrow(
        'AI_TIMEOUT_MS',
      );
    },
  );
});
