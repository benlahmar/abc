import { Router, type Request } from 'express';
import { z } from 'zod';
import { isCollectionName, type NewsDetail, type NewsPage } from '@fsbm/shared';
import type { ContentRepository } from '../repository.js';
import { HttpError } from '../errors.js';

const NewsQuery = z.object({
  category: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const parseQuery = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> => {
  const result = schema.safeParse(req.query);
  if (!result.success) throw new HttpError(400, 'invalid_query', result.error.issues.map((i) => i.message).join(' ; '));
  return result.data;
};

export function contentRouter(repo: ContentRepository): Router {
  const router = Router();

  // Actualités : tri par date décroissante, filtre par catégorie, pagination.
  router.get('/news', async (req, res) => {
    const { category, limit, offset } = parseQuery(NewsQuery, req);
    const news = await repo.get('news');
    const sorted = [...news.items].sort((a, b) => b.date.localeCompare(a.date));
    const filtered = category ? sorted.filter((item) => item.category === category) : sorted;
    const counts: Record<string, number> = { all: sorted.length };
    for (const item of sorted) counts[item.category] = (counts[item.category] ?? 0) + 1;
    const body: NewsPage = {
      categories: news.categories,
      counts,
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    };
    res.json(body);
  });

  router.get('/news/:id', async (req, res) => {
    const news = await repo.get('news');
    const item = news.items.find((entry) => entry.id === req.params.id);
    if (!item) throw new HttpError(404, 'not_found', 'Actualité introuvable');
    const body: NewsDetail = { item, category: news.categories.find((c) => c.id === item.category) ?? null };
    res.json(body);
  });

  // Toute autre collection est renvoyée telle quelle.
  router.get('/:collection', async (req, res) => {
    const { collection } = req.params;
    if (!isCollectionName(collection)) throw new HttpError(404, 'not_found', 'Collection inconnue');
    res.json(await repo.get(collection));
  });

  return router;
}
