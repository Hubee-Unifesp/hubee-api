import { afterEach, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { pushSchema } from 'drizzle-kit/api';
import { existsSync, readFileSync } from 'node:fs';
import * as schema from './schema';

const MIGRATIONS_FOLDER = 'src/database/migrations';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

const journal: { entries: JournalEntry[] } = JSON.parse(
  readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8'),
);

function migrationSql(tag: string): string {
  return readFileSync(`${MIGRATIONS_FOLDER}/${tag}.sql`, 'utf8');
}

describe('Migrations Drizzle (Postgres em memória)', () => {
  let pg: PGlite;

  function database() {
    pg = new PGlite();
    return drizzle(pg, { schema });
  }

  // O pushSchema do drizzle-kit não consegue introspectar um banco PGlite já
  // populado, então a comparação com o schema é feita pelo catálogo do Postgres.
  // NOT NULL já aparece em is_nullable (o nome da constraint muda com renames) e
  // os casts das definições variam conforme quem criou a constraint.
  async function catalog(client: PGlite) {
    const queries = {
      columns: `SELECT table_name, column_name, data_type, character_maximum_length,
          numeric_precision, numeric_scale, is_nullable, column_default
        FROM information_schema.columns WHERE table_schema = 'public'
        ORDER BY table_name, column_name`,
      constraints: `SELECT c.relname, con.conname, pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
        WHERE con.connamespace = 'public'::regnamespace AND con.contype <> 'n'
        ORDER BY c.relname, con.conname`,
      indexes: `SELECT tablename, indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' ORDER BY tablename, indexname`,
      enums: `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        GROUP BY t.typname ORDER BY t.typname`,
    };
    const result: Record<string, unknown[]> = {};
    for (const [name, query] of Object.entries(queries)) {
      const { rows } = await client.query<Record<string, unknown>>(query);
      result[name] = rows.map((row) =>
        typeof row.definition === 'string'
          ? {
              ...row,
              definition: row.definition
                .replace(/::[a-z ]+(\[\])?/g, '')
                .replace(/[()\s]/g, ''),
            }
          : row,
      );
    }
    return result;
  }

  async function expectedCatalog() {
    const client = new PGlite();
    const { apply } = await pushSchema(
      schema as any,
      drizzle(client, { schema }) as any,
    );
    await apply();
    const result = await catalog(client);
    await client.close();
    return result;
  }

  afterEach(async () => {
    await pg?.close();
  });

  it('mantém o journal ordenado e com arquivo para cada migration', () => {
    journal.entries.forEach((entry, index) => {
      expect(entry.idx).toBe(index);
      expect(existsSync(`${MIGRATIONS_FOLDER}/${entry.tag}.sql`)).toBe(true);
      if (index > 0) {
        expect(entry.when).toBeGreaterThan(journal.entries[index - 1].when);
      }
    });
  });

  it('cria um banco vazio idêntico ao schema', async () => {
    const db = database();

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(await catalog(pg)).toEqual(await expectedCatalog());
  });

  it('reaplica todas as migrations sem erro em um banco já migrado', async () => {
    const db = database();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    for (const { tag } of journal.entries) {
      await pg.exec(migrationSql(tag));
    }
    await pg.exec('DELETE FROM "drizzle"."__drizzle_migrations"');
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(await catalog(pg)).toEqual(await expectedCatalog());
  });

  it('aplica as migrations em um banco criado via db:push', async () => {
    const db = database();
    const { apply } = await pushSchema(schema as any, db as any);
    await apply();

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(await catalog(pg)).toEqual(await expectedCatalog());
  });

  it('migra um banco legado sem journal preservando os dados de usuários', async () => {
    const db = database();
    await pg.exec(migrationSql('0000_lyrical_spencer_smythe'));
    await pg.exec(`
      INSERT INTO "users" ("first_name", "last_name", "email", "password", "profile_type")
      VALUES
        (' Ana ', 'Souza', 'ana@hubee.com', 'hash', 'ADMIN'),
        ('Bruno', 'Lima', 'bruno@hubee.com', 'hash', 'ORGANIZER');
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const { rows } = await pg.query<{ full_name: string; role: string }>(
      'SELECT "full_name", "role" FROM "users" ORDER BY "email"',
    );
    expect(rows).toEqual([
      { full_name: 'Ana Souza', role: 'ADMIN' },
      { full_name: 'Bruno Lima', role: 'USER' },
    ]);
    expect(await catalog(pg)).toEqual(await expectedCatalog());
  });
});
