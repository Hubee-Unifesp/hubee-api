/**
 * Roda o seed contra o banco configurado no `.env` (DB_HOST, DB_USER, ...).
 *
 *   SEED_ADMIN_PASSWORD=... SEED_USER_PASSWORD=... npm run db:seed
 *
 * Para um banco que não seja local (Neon/produção), é preciso confirmar
 * explicitamente com `npm run db:seed -- --confirm-remote`.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';
import { runSeed } from './seed';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente "${key}" é obrigatória para o seed.`);
  }
  return value;
}

function password(key: string): string {
  const value = required(key);
  if (value.length < 8) {
    throw new Error(`"${key}" precisa ter pelo menos 8 caracteres.`);
  }
  return value;
}

async function main(): Promise<void> {
  const host = required('DB_HOST');
  const database = required('DB_NAME');
  const adminPassword = password('SEED_ADMIN_PASSWORD');
  const userPassword = password('SEED_USER_PASSWORD');

  if (
    !LOCAL_HOSTS.includes(host) &&
    !process.argv.includes('--confirm-remote')
  ) {
    throw new Error(
      `O banco "${database}" em "${host}" não é local. Rode de novo com --confirm-remote para confirmar.`,
    );
  }

  const pool = new Pool({
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database,
    ssl: process.env.DB_SSL === 'true',
  });

  try {
    console.log(`Rodando seed em ${host}/${database}...`);
    const summary = await runSeed(drizzle(pool, { schema }), {
      adminPassword,
      userPassword,
    });
    console.log('Seed concluído. Linhas criadas nesta execução:');
    console.table(summary);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  // Erros do Drizzle trazem o erro real do Postgres em `cause`.
  if (error instanceof Error && error.cause instanceof Error) {
    console.error(`Causa: ${error.cause.message}`);
  }
  process.exitCode = 1;
});
