const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

test('migrations: instalação, atualização, índices e segunda execução', async () => {
  assert.ok(
    process.env.TEST_DATABASE_URL,
    'Informe TEST_DATABASE_URL de um Postgres de teste com permissão CREATE DATABASE.',
  );
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const database = `hubee_migrations_${process.pid}_${Date.now()}`;
  const folder = path.resolve(__dirname, '../src/database/migrations');
  const temporary = mkdtempSync(path.join(tmpdir(), 'hubee-migrations-'));
  let pool;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.pathname = `/${database}`;
    pool = new Pool({ connectionString: url.toString() });
    const db = drizzle(pool);
    const journal = JSON.parse(
      readFileSync(path.join(folder, 'meta/_journal.json'), 'utf8'),
    );
    mkdirSync(path.join(temporary, 'meta'));
    const historical = { ...journal, entries: journal.entries.slice(0, 4) };
    writeFileSync(
      path.join(temporary, 'meta/_journal.json'),
      JSON.stringify(historical),
    );
    for (const entry of historical.entries) {
      copyFileSync(
        path.join(folder, `${entry.tag}.sql`),
        path.join(temporary, `${entry.tag}.sql`),
      );
    }
    await migrate(db, { migrationsFolder: temporary });
    const user =
      await pool.query(`INSERT INTO users (first_name, last_name, email, password, cpf, birth_date, profile_type)
      VALUES ('Teste', 'Migration', 'test@example.com', 'hash', '12345678901', '2000-01-01', 'organizer') RETURNING id`);
    const org = await pool.query(
      `INSERT INTO organizations (name) VALUES ('Teste') RETURNING id`,
    );
    await pool.query(
      `INSERT INTO organization_users (organization_id, user_id, role, permission) VALUES ($1, $2, 'member', 'read')`,
      [org.rows[0].id, user.rows[0].id],
    );
    await migrate(db, { migrationsFolder: folder });
    assert.equal(
      (await pool.query('SELECT status FROM users')).rows[0].status,
      'ACTIVE',
    );
    assert.equal(
      (await pool.query('SELECT invite_status FROM organization_users')).rows[0]
        .invite_status,
      'pending',
    );
    const tables = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    assert.deepEqual(
      tables.rows.map((row) => row.tablename),
      [
        'addresses',
        'organization_users',
        'organizations',
        'suppliers',
        'users',
        'venues',
      ],
    );
    const history = await pool.query(
      'SELECT * FROM drizzle.__drizzle_migrations ORDER BY id',
    );
    assert.equal(history.rowCount, journal.entries.length);
    await migrate(db, { migrationsFolder: folder });
    assert.deepEqual(
      (
        await pool.query(
          'SELECT * FROM drizzle.__drizzle_migrations ORDER BY id',
        )
      ).rows,
      history.rows,
    );
    for (const [table, insert] of [
      [
        'users',
        `INSERT INTO users (first_name, last_name, email, password, cpf, birth_date, profile_type) VALUES ('Novo', 'Teste', 'test@example.com', 'hash', '12345678901', '2000-01-01', 'organizer')`,
      ],
      [
        'suppliers',
        `INSERT INTO suppliers (company_name, email, cnpj_cpf) VALUES ('Teste', 'supplier@example.com', '12345678901234')`,
      ],
    ]) {
      if (table === 'suppliers') await pool.query(insert);
      await assert.rejects(pool.query(insert), { code: '23505' });
      await pool.query(`UPDATE ${table} SET deleted_at = now()`);
      await pool.query(insert);
      await assert.rejects(pool.query(insert), { code: '23505' });
    }
    assert.equal(
      (await pool.query('SELECT status FROM users WHERE deleted_at IS NULL'))
        .rows[0].status,
      'ACTIVE',
    );
    const indexes = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('users', 'suppliers') AND indexdef LIKE '%WHERE%'`,
    );
    assert.equal(indexes.rowCount, 4);
  } finally {
    if (pool) await pool.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
    rmSync(temporary, { recursive: true, force: true });
  }
});
