import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp, DATA_DIR, MemoryStore } from './testing.js';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('API de contenu', () => {
  const app = () => t.app;

  it('répond au contrôle de santé', async () => {
    const res = await request(app()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it.each(['site', 'hero', 'programmes', 'stats', 'news', 'services', 'dean', 'faculty', 'testimonials', 'gallery', 'explore'])(
    'sert la collection %s (données valides)',
    async (name) => {
      const res = await request(app()).get(`/api/v1/${name}`);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
    },
  );

  it('trie, filtre et pagine les actualités', async () => {
    const res = await request(app()).get('/api/v1/news?category=scolarite&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.counts).toMatchObject({ all: 4, scolarite: 3, recherche: 1 });
    const dates = res.body.items.map((i: { date: string }) => i.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('renvoie une actualité et sa catégorie', async () => {
    const res = await request(app()).get('/api/v1/news/etudiants-inscrits-2025-2026');
    expect(res.status).toBe(200);
    expect(res.body.item.attachments).toHaveLength(24);
    expect(res.body.category.label).toBe('Scolarité');
  });

  it('rejette une pagination invalide', async () => {
    const res = await request(app()).get('/api/v1/news?limit=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_query');
  });

  it('renvoie 404 pour une collection ou une actualité inconnue', async () => {
    expect((await request(app()).get('/api/v1/inconnu')).status).toBe(404);
    expect((await request(app()).get('/api/v1/news/inconnue')).status).toBe(404);
  });
});

describe('Validation des données', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fsbm-'));
    await cp(DATA_DIR, dir, { recursive: true });
    await writeFile(join(dir, 'stats.json'), JSON.stringify({ items: [{ id: 'x', value: 'pas un nombre', label: 'X' }] }));
  });

  it('renvoie 500 sans exposer le détail si une collection est invalide', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const other = await createTestApp({ dataDir: dir });
    const res = await request(other.app).get('/api/v1/stats');
    await other.close();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('content_unavailable');
    expect(JSON.stringify(res.body)).not.toContain('pas un nombre');
  });
});

describe('Formulaire de contact', () => {
  const valid = { name: 'Amina Benali', email: 'amina@example.ma', subject: 'scolarite', message: 'Bonjour, je souhaite une attestation.' };

  it('enregistre un message valide', async () => {
    const store = new MemoryStore();
    const res = await request((await createTestApp({ messages: store })).app).post('/api/v1/contact').send(valid);
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]).not.toHaveProperty('website');
  });

  it('renvoie les erreurs par champ', async () => {
    const res = await request((await createTestApp()).app)
      .post('/api/v1/contact')
      .send({ ...valid, email: 'pas-un-email', message: 'court' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'message']);
  });

  it('ignore silencieusement les robots (champ piège rempli)', async () => {
    const store = new MemoryStore();
    const res = await request((await createTestApp({ messages: store })).app).post('/api/v1/contact').send({ ...valid, website: 'spam.example' });
    expect(res.status).toBe(201);
    expect(store.saved).toHaveLength(0);
  });

  it('limite le nombre de messages par adresse IP', async () => {
    const app = (await createTestApp()).app;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await request(app).post('/api/v1/contact').send(valid)).status);
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('refuse un corps trop volumineux', async () => {
    const res = await request((await createTestApp()).app)
      .post('/api/v1/contact')
      .send({ ...valid, message: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('refuse un JSON mal formé avec une erreur 400', async () => {
    const res = await request((await createTestApp()).app)
      .post('/api/v1/contact')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
  });
});
