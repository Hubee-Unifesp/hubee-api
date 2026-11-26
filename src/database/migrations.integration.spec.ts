import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
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
  let expected: Record<string, unknown[]>;

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

  // O catálogo esperado não depende do teste: montar uma vez poupa um
  // pushSchema (e um PGlite) por caso.
  beforeAll(async () => {
    expected = await expectedCatalog();
  });

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

    expect(await catalog(pg)).toEqual(expected);
  });

  it('reaplica todas as migrations sem erro em um banco já migrado', async () => {
    const db = database();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    for (const { tag } of journal.entries) {
      await pg.exec(migrationSql(tag));
    }
    await pg.exec('DELETE FROM "drizzle"."__drizzle_migrations"');
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(await catalog(pg)).toEqual(expected);
  });

  it('aplica as migrations em um banco criado via db:push', async () => {
    const db = database();
    const { apply } = await pushSchema(schema as any, db as any);
    await apply();

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    expect(await catalog(pg)).toEqual(expected);
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
    expect(await catalog(pg)).toEqual(expected);
  });

  it('cria supplier_reviews com nota de 1 a 5 e uma avaliação por usuário', async () => {
    const db = database();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const {
      rows: [ids],
    } = await pg.query<{ supplier_id: string; user_id: string }>(`
      WITH s AS (
        INSERT INTO "suppliers" ("company_name", "cnpj_cpf")
        VALUES ('Buffet', '11222333000181') RETURNING "id"
      ), u AS (
        INSERT INTO "users" ("full_name", "email", "password")
        VALUES ('Ana', 'ana@hubee.com', 'hash') RETURNING "id"
      )
      SELECT s.id AS supplier_id, u.id AS user_id FROM s, u
    `);
    const insertReview = (rating: number) =>
      pg.query(
        'INSERT INTO "supplier_reviews" ("supplier_id", "user_id", "rating") VALUES ($1, $2, $3)',
        [ids.supplier_id, ids.user_id, rating],
      );

    await expect(insertReview(0)).rejects.toThrow(
      /supplier_reviews_rating_range/,
    );
    await expect(insertReview(6)).rejects.toThrow(
      /supplier_reviews_rating_range/,
    );
    await insertReview(5);
    await expect(insertReview(4)).rejects.toThrow(
      /supplier_reviews_supplier_id_user_id_unique/,
    );
  });

  it('cria notifications com cascade ao remover usuário e valida notification_type', async () => {
    const db = database();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const {
      rows: [user],
    } = await pg.query<{ id: string }>(`
      INSERT INTO "users" ("full_name", "email", "password")
      VALUES ('Carlos', 'carlos@hubee.com', 'hash') RETURNING "id"
    `);

    await pg.query(
      'INSERT INTO "notifications" ("user_id", "type", "title", "message", "href") VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        'payment_confirmed',
        'Pagamento confirmado',
        'Ingressos emitidos',
        '/conta/ingressos',
      ],
    );

    await expect(
      pg.query(
        'INSERT INTO "notifications" ("user_id", "type", "title", "message") VALUES ($1, $2, $3, $4)',
        [user.id, 'tipo_invalido', 'Título', 'Mensagem'],
      ),
    ).rejects.toThrow(/notification_type/);

    await pg.query('DELETE FROM "users" WHERE "id" = $1', [user.id]);
    const { rows } = await pg.query('SELECT * FROM "notifications"');
    expect(rows).toHaveLength(0);
  });

  it('migra despesas antigas sem perda de dados e valida constraints de orçamento', async () => {
    const db = database();
    const expensesMigrationIndex = journal.entries.findIndex(
      (entry) => entry.tag === '0011_expenses_budget_format',
    );
    for (const entry of journal.entries.slice(0, expensesMigrationIndex)) {
      await pg.exec(migrationSql(entry.tag));
    }

    const {
      rows: [ids],
    } = await pg.query<{ event_id: string; supplier_id: string }>(`
      WITH addr AS (
        INSERT INTO "addresses" ("zip_code", "street", "number", "neighborhood", "city", "state")
        VALUES ('01310-100', 'Av. Paulista', '100', 'Bela Vista', 'São Paulo', 'SP')
        RETURNING "id"
      ), ven AS (
        INSERT INTO "venues" ("name", "max_capacity", "address_id")
        SELECT 'Arena', 1000, "id" FROM addr
        RETURNING "id"
      ), org AS (
        INSERT INTO "organizations" ("name")
        VALUES ('Org Teste')
        RETURNING "id"
      ), ev AS (
        INSERT INTO "events" ("name", "organizer_id", "venue_id", "start_date", "end_date")
        SELECT 'Evento Legado', org.id, ven.id, '2026-12-01T18:00:00Z', '2026-12-01T23:00:00Z'
        FROM org, ven
        RETURNING "id"
      ), sup AS (
        INSERT INTO "suppliers" ("company_name", "cnpj_cpf")
        VALUES ('Fornecedor Legado', '12345678000199')
        RETURNING "id"
      )
      SELECT ev.id AS event_id, sup.id AS supplier_id FROM ev, sup
    `);

    await pg.query(
      `INSERT INTO "expenses" ("event_id", "fornecedor_id", "description", "amount", "cost_type", "due_date", "payment_status")
       VALUES ($1, $2, 'Palco Principal', 2500.50, 'Estrutura', '2026-11-30T00:00:00Z', 'pago')`,
      [ids.event_id, ids.supplier_id],
    );

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const { rows } = await pg.query<{
      description: string;
      group: string;
      category: string;
      quantity: string;
      unit_price: string;
      amount: string;
      quoted: boolean;
      payment_status: string;
      fornecedor_id: string;
    }>('SELECT * FROM "expenses"');

    expect(rows).toEqual([
      expect.objectContaining({
        description: 'Palco Principal',
        group: 'fixed',
        category: 'Estrutura',
        quantity: '1.00',
        unit_price: '2500.50',
        amount: '2500.50',
        quoted: false,
        payment_status: 'pago',
        fornecedor_id: ids.supplier_id,
      }),
    ]);

    await expect(
      pg.query(
        `INSERT INTO "expenses" ("event_id", "description", "group", "category", "quantity", "unit_price", "amount")
         VALUES ($1, 'Qtd negativa', 'fixed', 'Estrutura', -1, 10, 0)`,
        [ids.event_id],
      ),
    ).rejects.toThrow(/expenses_quantity_non_negative/);

    await expect(
      pg.query(
        `INSERT INTO "expenses" ("event_id", "description", "group", "category", "quantity", "unit_price", "amount")
         VALUES ($1, 'Preço negativo', 'fixed', 'Estrutura', 1, -5, 0)`,
        [ids.event_id],
      ),
    ).rejects.toThrow(/expenses_unit_price_non_negative/);

    expect(await catalog(pg)).toEqual(expected);
  });
});
