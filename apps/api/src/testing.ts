import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { createApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { migrate, openDatabase } from './db/index.js';
import { seedDemo } from './demo.js';
import type { ContactPayload, MessageStore, StoredMessage } from './messages.js';
import { JsonFileRepository } from './repository.js';

export const DATA_DIR = resolve(import.meta.dirname, '../data');
export const DEMO_PASSWORD = 'Demo-FSBM-2026';

export class MemoryStore implements MessageStore {
  saved: StoredMessage[] = [];
  async save(message: ContactPayload) {
    const stored = { id: String(this.saved.length + 1), receivedAt: new Date().toISOString(), ...message };
    this.saved.push(stored);
    return stored;
  }
}

/** Application complète sur une base PGlite en mémoire, avec comptes de démonstration et actualités importées. */
export async function createTestApp(options: { dataDir?: string; messages?: MessageStore } = {}) {
  const database = await openDatabase({});
  await migrate(database, resolve(import.meta.dirname, '../migrations'));
  await bootstrap(database.db, { dataDir: options.dataDir ?? DATA_DIR, admin: {} });
  await seedDemo(database.db, DEMO_PASSWORD);
  await bootstrap(database.db, { dataDir: options.dataDir ?? DATA_DIR, admin: {} });
  const uploadsDir = await mkdtemp(join(tmpdir(), 'fsbm-uploads-'));
  const app = createApp({
    repo: new JsonFileRepository(options.dataDir ?? DATA_DIR),
    messages: options.messages ?? new MemoryStore(),
    db: database.db,
    uploadsDir,
  });
  return { app, db: database.db, database, uploadsDir, close: () => database.close() };
}

/** Client connecté (cookie de session + en-tête anti-CSRF). */
export async function loginAs(app: Parameters<typeof request.agent>[0], email: string, password = DEMO_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/admin/auth/login').set('x-fsbm-csrf', '1').send({ email, password });
  if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} : ${res.status} ${JSON.stringify(res.body)}`);
  return {
    agent,
    get: (url: string) => agent.get(`/api/admin${url}`),
    post: (url: string, body?: object) => agent.post(`/api/admin${url}`).set('x-fsbm-csrf', '1').send(body),
    patch: (url: string, body?: object) => agent.patch(`/api/admin${url}`).set('x-fsbm-csrf', '1').send(body),
    del: (url: string) => agent.delete(`/api/admin${url}`).set('x-fsbm-csrf', '1'),
  };
}
