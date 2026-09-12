import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtractTablesWithRelations } from 'drizzle-orm';
import {
  drizzle,
  NodePgDatabase,
  NodePgTransaction,
} from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { EnvironmentVariables } from '../config/env.validation';
import { DRIZZLE, PG_POOL } from './database.constants';
import * as schema from './schema';

/** Tipo do client Drizzle usado em toda a aplicação. */
export type DrizzleDatabase = NodePgDatabase<typeof schema>;

/** Tipo do client dentro de um `db.transaction(async (tx) => ...)`. */
export type DrizzleTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** O que um repository deve aceitar: o client normal OU uma transaction em andamento. */
export type DbExecutor = DrizzleDatabase | DrizzleTransaction;

export const pgPoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvironmentVariables, true>): Pool => {
    const pool = new Pool({
      host: config.get('DB_HOST', { infer: true }),
      port: config.get('DB_PORT', { infer: true }),
      user: config.get('DB_USER', { infer: true }),
      password: config.get('DB_PASSWORD', { infer: true }),
      database: config.get('DB_NAME', { infer: true }),
      // Neon exige TLS; Postgres local normalmente roda sem.
      ssl: config.get('DB_SSL', { infer: true }),
    });

    pool.on('error', (error) => {
      new Logger('DatabasePool').error(
        'Erro em uma conexão ociosa do pool',
        error.stack,
      );
    });

    return pool;
  },
};

export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [PG_POOL],
  useFactory: (pool: Pool): DrizzleDatabase => drizzle(pool, { schema }),
};
