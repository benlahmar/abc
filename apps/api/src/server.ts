import { createApp } from './app.js';
import { config } from './config.js';
import { JsonFileRepository } from './repository.js';
import { JsonlMessageStore } from './messages.js';

const app = createApp({
  repo: new JsonFileRepository(config.dataDir),
  messages: new JsonlMessageStore(config.storageDir),
  corsOrigins: config.corsOrigins,
  webDist: config.webDist,
});

const server = app.listen(config.port, () => {
  console.log(`API FSBM prête sur http://localhost:${config.port}/api/v1 (données : ${config.dataDir})`);
  if (config.webDist) console.log(`Front-end servi depuis ${config.webDist}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} reçu, arrêt en cours…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
