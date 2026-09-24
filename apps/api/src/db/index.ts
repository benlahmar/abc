import { mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  /** Exécute un script SQL brut (plusieurs instructions). */
  exec(sqlText: string): Promise<void>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

/**
 * Ouvre la base :
 *  - DATABASE_URL défini → PostgreSQL (production) ;
 *  - sinon → PGlite (PostgreSQL embarqué) : dans `dataDir` pour le développement, en mémoire pour les tests.
 */
export async function openDatabase(options: { url?: string; dataDir?: string | null }): Promise<Database> {
  if (options.url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({ connectionString: options.url, max: 10 });
    return {
      db: drizzle(pool, { schema }) as unknown as Db,
      exec: async (text) => {
        await pool.query(text);
      },
      close: () => pool.end(),
      kind: 'postgres',
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  if (options.dataDir) await mkdir(options.dataDir, { recursive: true });
  const client = new PGlite(options.dataDir ?? undefined);
  return {
    db: drizzle(client, { schema }) as unknown as Db,
    exec: async (text) => {
      await client.exec(text);
    },
    close: () => client.close(),
    kind: 'pglite',
  };
}

/** Applique, dans l'ordre, les fichiers migrations/NNNN_*.sql non encore appliqués. */
export async function migrate(database: Database, migrationsDir: string): Promise<string[]> {
  await database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const rows = await database.db.execute<{ name: string }>(sql`SELECT name FROM schema_migrations`);
  const done = new Set((rows as unknown as { rows: Array<{ name: string }> }).rows.map((r) => r.name));
  const files = (await readdir(migrationsDir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const text = await readFile(resolve(migrationsDir, file), 'utf8');
    await database.exec(`BEGIN;\n${text}\nINSERT INTO schema_migrations (name) VALUES ('${file.replace(/'/g, "''")}');\nCOMMIT;`);
    applied.push(file);
  }
  return applied;
}

export { schema };
