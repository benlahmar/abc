import express, { Router } from 'express';
import type { Db } from '../db/index.js';
import { HttpError } from '../errors.js';
import { auditRouter } from './auditRoutes.js';
import { authenticate, authRouter, requirePasswordChanged, type AuthOptions } from './auth.js';
import { categoriesRouter } from './categories.js';
import { contentsRouter } from './contents.js';
import { csrfGuard } from './security.js';
import { uploadsRouter } from './uploads.js';
import { usersRouter } from './users.js';

export interface AdminOptions extends AuthOptions {
  uploadsDir: string;
}

/** API du back-office, montée sur /api/admin. Aucune réponse n'est mise en cache. */
export function adminRouter(db: Db, options: AdminOptions): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(express.json({ limit: '256kb' }));
  router.use(csrfGuard);

  const auth = authRouter(db, options);
  router.use(auth.publicRoutes);
  router.use(authenticate(db, options));
  router.use(requirePasswordChanged);
  router.use(auth.sessionRoutes);
  router.use(usersRouter(db));
  router.use(categoriesRouter(db));
  router.use(contentsRouter(db));
  router.use(auditRouter(db));
  router.use(uploadsRouter(db, options.uploadsDir));
  router.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'Ressource introuvable')));
  return router;
}
