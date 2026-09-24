import { join } from 'node:path';
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, HttpError } from './errors.js';
import type { ContentRepository } from './repository.js';
import { contentRouter } from './routes/content.js';

export interface AppOptions {
  repo: ContentRepository;
  corsOrigins?: string[];
  /** Dossier du front-end compilé à servir (production). */
  webDist?: string | null;
}

export function createApp({ repo, corsOrigins = [], webDist = null }: AppOptions): Express {
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
  api.use(cors({ origin: corsOrigins, methods: ['GET'] }));
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    next();
  });
  api.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });
  api.use(contentRouter(repo));
  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'Ressource introuvable')));

  app.use('/api/v1', api);

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
