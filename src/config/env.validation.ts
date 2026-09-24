export interface EnvironmentVariables {
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
  JWT_SECRET: string; // <-- Adicionado aqui
}

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
  };
}
