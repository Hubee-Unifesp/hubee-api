export interface EnvironmentVariables {
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
  JWT_SECRET: string;
  BLOB_READ_WRITE_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;
  AI_TIMEOUT_MS: number;
  AI_MAX_TOKENS: number;
  AI_EFFORT: AiEffort;
  AI_RATE_LIMIT_MAX: number;
  AI_RATE_LIMIT_WINDOW_MS: number;
}

export const AI_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type AiEffort = (typeof AI_EFFORTS)[number];

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
const DEFAULT_AI_TIMEOUT_MS = 30000;
const DEFAULT_AI_MAX_TOKENS = 16000;
const DEFAULT_AI_EFFORT: AiEffort = 'medium';
const DEFAULT_AI_RATE_LIMIT_MAX = 5;
const DEFAULT_AI_RATE_LIMIT_WINDOW_MS = 60000;

function requireString(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Variável de ambiente "${key}" é obrigatória.`);
  }

  return value.trim();
}

function requirePort(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  fallback: number,
): number {
  const value = config[key];

  if (value === undefined || value === '') {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Variável de ambiente "${key}" deve ser uma porta válida (1-65535).`,
    );
  }

  return port;
}

function optionalBoolean(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  fallback: boolean,
): boolean {
  const value = config[key];

  if (value === undefined || value === '') {
    return fallback;
  }

  if (value !== 'true' && value !== 'false') {
    throw new Error(
      `Variável de ambiente "${key}" deve ser "true" ou "false".`,
    );
  }

  return value === 'true';
}

function optionalString(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
): string | undefined {
  const value = config[key];

  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function optionalPositiveInteger(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  fallback: number,
): number {
  const value = config[key];

  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Variável de ambiente "${key}" deve ser um número inteiro positivo.`,
    );
  }

  return parsed;
}

function optionalAiEffort(
  config: Record<string, unknown>,
  key: keyof EnvironmentVariables,
  fallback: AiEffort,
): AiEffort {
  const value = optionalString(config, key);

  if (value === undefined) {
    return fallback;
  }

  if (!(AI_EFFORTS as readonly string[]).includes(value)) {
    throw new Error(
      `Variável de ambiente "${key}" deve ser um destes valores: ${AI_EFFORTS.join(', ')}.`,
    );
  }

  return value as AiEffort;
}

/**
 * Valida as variáveis de ambiente no boot da aplicação. Falhar aqui é
 * proposital: é melhor a API não subir do que subir sem saber falar com o banco.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  return {
    PORT: requirePort(config, 'PORT', 3000),
    DB_HOST: requireString(config, 'DB_HOST'),
    DB_PORT: requirePort(config, 'DB_PORT', 5432),
    DB_USER: requireString(config, 'DB_USER'),
    DB_PASSWORD: requireString(config, 'DB_PASSWORD'),
    DB_NAME: requireString(config, 'DB_NAME'),
    DB_SSL: optionalBoolean(config, 'DB_SSL', false),
    JWT_SECRET: requireString(config, 'JWT_SECRET'),
    BLOB_READ_WRITE_TOKEN: optionalString(config, 'BLOB_READ_WRITE_TOKEN'),
    ANTHROPIC_API_KEY: optionalString(config, 'ANTHROPIC_API_KEY'),
    ANTHROPIC_MODEL:
      optionalString(config, 'ANTHROPIC_MODEL') ?? DEFAULT_ANTHROPIC_MODEL,
    AI_TIMEOUT_MS: optionalPositiveInteger(
      config,
      'AI_TIMEOUT_MS',
      DEFAULT_AI_TIMEOUT_MS,
    ),
    AI_MAX_TOKENS: optionalPositiveInteger(
      config,
      'AI_MAX_TOKENS',
      DEFAULT_AI_MAX_TOKENS,
    ),
    AI_EFFORT: optionalAiEffort(config, 'AI_EFFORT', DEFAULT_AI_EFFORT),
    AI_RATE_LIMIT_MAX: optionalPositiveInteger(
      config,
      'AI_RATE_LIMIT_MAX',
      DEFAULT_AI_RATE_LIMIT_MAX,
    ),
    AI_RATE_LIMIT_WINDOW_MS: optionalPositiveInteger(
      config,
      'AI_RATE_LIMIT_WINDOW_MS',
      DEFAULT_AI_RATE_LIMIT_WINDOW_MS,
    ),
  };
}
