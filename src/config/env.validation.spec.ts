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
