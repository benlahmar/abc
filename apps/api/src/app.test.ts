import { mkdtemp, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { JsonFileRepository } from './repository.js';

const DATA = resolve(import.meta.dirname, '../data');

describe('API de contenu', () => {
  const app = createApp({ repo: new JsonFileRepository(DATA) });

  it('répond au contrôle de santé', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it.each(['site', 'hero', 'programmes', 'stats', 'news', 'services', 'dean', 'faculty', 'testimonials'])(
    'sert la collection %s (données valides)',
    async (name) => {
      const res = await request(app).get(`/api/v1/${name}`);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
    },
  );

  it('trie, filtre et pagine les actualités', async () => {
    const res = await request(app).get('/api/v1/news?category=campus&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.counts).toMatchObject({ all: 4, campus: 3, recherche: 1 });
    const dates = res.body.items.map((i: { date: string }) => i.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('renvoie une actualité et sa catégorie', async () => {
    const res = await request(app).get('/api/v1/news/etudiants-inscrits-2025-2026');
    expect(res.status).toBe(200);
    expect(res.body.item.attachments).toHaveLength(24);
    expect(res.body.category.label).toBe('Campus');
  });

  it('rejette une pagination invalide', async () => {
    const res = await request(app).get('/api/v1/news?limit=0');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_query');
  });

  it('renvoie 404 pour une collection ou une actualité inconnue', async () => {
    expect((await request(app).get('/api/v1/inconnu')).status).toBe(404);
    expect((await request(app).get('/api/v1/news/inconnue')).status).toBe(404);
  });
});

describe('Validation des données', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fsbm-'));
    await cp(DATA, dir, { recursive: true });
    await writeFile(join(dir, 'stats.json'), JSON.stringify({ items: [{ id: 'x', value: 'pas un nombre', label: 'X' }] }));
  });

  it('renvoie 500 sans exposer le détail si une collection est invalide', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(createApp({ repo: new JsonFileRepository(dir) })).get('/api/v1/stats');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('content_unavailable');
    expect(JSON.stringify(res.body)).not.toContain('pas un nombre');
  });
});
