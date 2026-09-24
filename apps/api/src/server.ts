import { join } from 'node:path';
import { createApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { config } from './config.js';
import { migrate, openDatabase } from './db/index.js';
import { JsonlMessageStore } from './messages.js';
import { JsonFileRepository } from './repository.js';
import { startScheduler } from './scheduler.js';

const database = await openDatabase({ url: config.databaseUrl, dataDir: config.databaseUrl ? null : config.pgliteDir });
const applied = await migrate(database, config.migrationsDir);
if (applied.length) console.log(`Migrations appliquées : ${applied.join(', ')}`);

const { admin, imported } = await bootstrap(database.db, {
  dataDir: config.dataDir,
  admin: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME },
});
if (admin) console.log(`Premier administrateur créé : ${admin.email} (mot de passe à changer à la première connexion)`);
if (imported) console.log(`${imported} actualités importées depuis news.json`);

const app = createApp({
  repo: new JsonFileRepository(config.dataDir),
  messages: new JsonlMessageStore(config.storageDir),
  db: database.db,
  uploadsDir: join(config.storageDir, 'uploads'),
  corsOrigins: config.corsOrigins,
  webDist: config.webDist,
  adminDist: config.adminDist,
  secureCookies: config.secureCookies,
  sessionTtlHours: config.sessionTtlHours,
});

const stopScheduler = startScheduler(database.db);

const server = app.listen(config.port, () => {
  console.log(`API FSBM prête sur http://localhost:${config.port}/api/v1 — base : ${database.kind}`);
  if (config.webDist) console.log(`Site servi depuis ${config.webDist}`);
  if (config.adminDist) console.log(`Back-office servi sur /admin depuis ${config.adminDist}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} reçu, arrêt en cours…`);
  stopScheduler();
  server.close(() => void database.close().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
