import { bootstrap } from '../bootstrap.js';
import { config } from '../config.js';
import { migrate, openDatabase } from '../db/index.js';
import { demoAccounts, seedDemo } from '../demo.js';

if (config.production) {
  console.error('Refusé : les comptes de démonstration ne doivent jamais être créés en production.');
  process.exit(1);
}
const password = process.env.DEMO_PASSWORD ?? 'Demo-FSBM-2026';
const database = await openDatabase({ url: config.databaseUrl, dataDir: config.databaseUrl ? null : config.pgliteDir });
await migrate(database, config.migrationsDir);
await bootstrap(database.db, { dataDir: config.dataDir, admin: {} });
await seedDemo(database.db, password);
// L'import des actualités nécessite un administrateur : on le relance une fois les comptes créés.
await bootstrap(database.db, { dataDir: config.dataDir, admin: {} });
await database.close();
console.log(`Comptes de démonstration prêts (mot de passe : ${password}) :`);
for (const a of demoAccounts) console.log(`  ${a.email.padEnd(32)} ${a.name}`);
