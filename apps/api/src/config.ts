import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// src/ en développement, dist/ en production : la racine du paquet est un niveau au-dessus.
const packageRoot = resolve(here, '..');

const defaultWebDist = resolve(packageRoot, '../web/dist');

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  dataDir: process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : resolve(packageRoot, 'data'),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  webDist: process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : existsSync(defaultWebDist) ? defaultWebDist : null,
};

export type Config = typeof config;
