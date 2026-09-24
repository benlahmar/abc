import { join } from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, HttpError } from './errors.js';
import type { ContentRepository } from './repository.js';
import { contentRouter } from './routes/content.js';
import { contactRouter } from './routes/contact.js';
import type { MessageStore } from './messages.js';
import type { Db } from './db/index.js';
import { NewsService } from './news.js';
import { adminRouter } from './admin/router.js';
import { serveUploads } from './admin/uploads.js';

export interface AppOptions {
  repo: ContentRepository;
  /** Stockage des messages du formulaire de contact. */
  messages: MessageStore;
  /** Base de données (actualités, back-office). */
  db: Db;
  /** Dossier des fichiers téléversés depuis le back-office. */
  uploadsDir: string;
  corsOrigins?: string[];
  /** Dossier du front-end compilé à servir (production). */
  webDist?: string | null;
  /** Dossier du back-office compilé, servi sur /admin (production). */
  adminDist?: string | null;
  secureCookies?: boolean;
  sessionTtlHours?: number;
}

export function createApp({
  repo,
  messages,
  db,
  uploadsDir,
  corsOrigins = [],
  webDist = null,
  adminDist = null,
  secureCookies = false,
  sessionTtlHours = 12,
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https://i.ytimg.com'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-src': ['https://www.youtube-nocookie.com'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'frame-ancestors': ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  const api = express.Router();
  api.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));
  api.use(contactRouter(messages));
  api.use((req, res, next) => {
    if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    next();
  });
  api.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });
  api.use(contentRouter(repo, new NewsService(db)));
  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'Ressource introuvable')));

  app.use('/api/v1', api);
  app.use('/api/admin', adminRouter(db, { uploadsDir, secureCookies, sessionTtlHours }));
  app.use('/uploads', serveUploads(uploadsDir), (_req, res) => void res.status(404).end());

  if (adminDist) {
    app.use('/admin', express.static(adminDist, { index: false }));
    app.get(['/admin', '/admin/{*path}'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(adminDist, 'index.html'));
    });
  }

  if (webDist) {
    const assetsDir = join(webDist, 'assets');
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, path) => {
          // Fichiers fingerprintés par Vite : cache long ; le reste : revalidation.
          res.setHeader('Cache-Control', path.startsWith(assetsDir) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
    // Application monopage : toute route non-API renvoie index.html.
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
