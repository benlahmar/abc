import type { ErrorRequestHandler } from 'express';
import { ContentError } from './repository.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Format d'erreur unique : { error: { code, message } }. Les détails internes ne sont jamais exposés. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ContentError) {
    console.error(`[content] ${error.message}`);
    res.status(500).json({ error: { code: 'content_unavailable', message: 'Contenu momentanément indisponible' } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { code: 'internal_error', message: 'Erreur interne du serveur' } });
};
