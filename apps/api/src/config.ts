import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// src/ en développement, dist/ en production : la racine du paquet est un niveau au-dessus.
export const packageRoot = resolve(here, '..');

const optionalDir = (env: string | undefined, fallback: string) => (env ? resolve(env) : existsSync(fallback) ? fallback : null);
const production = process.env.NODE_ENV === 'production';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  production,
  port: Number(process.env.PORT ?? 4000),
  dataDir: process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(packageRoot, 'data'),
  /** Données écrites par l'application (messages de contact, fichiers téléversés…). */
  storageDir: process.env.STORAGE_DIR ? resolve(process.env.STORAGE_DIR) : resolve(packageRoot, 'storage'),
  migrationsDir: resolve(packageRoot, 'migrations'),
  /** PostgreSQL (production). Sans cette variable, une base PGlite locale est utilisée. */
  databaseUrl: process.env.DATABASE_URL || undefined,
  pgliteDir: process.env.PGLITE_DIR ? resolve(process.env.PGLITE_DIR) : resolve(packageRoot, '.data/pglite'),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** Cookies « Secure » : obligatoires en production (HTTPS). */
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === 'true' : production,
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  webDist: optionalDir(process.env.WEB_DIST, resolve(packageRoot, '../web/dist')),
  adminDist: optionalDir(process.env.ADMIN_DIST, resolve(packageRoot, '../admin/dist')),
};

export type Config = typeof config;
