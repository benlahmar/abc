import { Router, type Request } from 'express';
import { z } from 'zod';
import { isCollectionName } from '@fsbm/shared';
import type { ContentRepository } from '../repository.js';
import type { NewsService } from '../news.js';
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

export function contentRouter(repo: ContentRepository, news: NewsService): Router {
  const router = Router();

  // Actualités (base de données, alimentée par le back-office) : tri par date, filtre par catégorie, pagination.
  router.get('/news', async (req, res) => {
    const { category, limit, offset } = parseQuery(NewsQuery, req);
    res.json(await news.page({ category, limit, offset }));
  });

  router.get('/news/:id', async (req, res) => {
    const detail = await news.bySlug(req.params.id);
    if (!detail) throw new HttpError(404, 'not_found', 'Actualité introuvable');
    res.json(detail);
  });

  // Toute autre collection est renvoyée telle quelle.
  router.get('/:collection', async (req, res) => {
    const { collection } = req.params;
    if (!isCollectionName(collection)) throw new HttpError(404, 'not_found', 'Collection inconnue');
    if (collection === 'news') return void res.json(await news.collection());
    res.json(await repo.get(collection));
  });

  return router;
}
