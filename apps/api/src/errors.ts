import type { ErrorRequestHandler } from 'express';
import { ContentError } from './repository.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Erreurs par champ (formulaires). */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Format d'erreur unique : { error: { code, message } }. Les détails internes ne sont jamais exposés. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } });
    return;
  }
  // Erreurs de lecture du corps (express.json) : corps trop volumineux, JSON mal formé…
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const code = status === 413 ? 'payload_too_large' : 'invalid_request';
    const message = status === 413 ? 'Le message est trop volumineux.' : 'Requête invalide.';
    res.status(status).json({ error: { code, message } });
    return;
  }
  // Violation d'unicité PostgreSQL (e-mail ou identifiant déjà utilisé…).
  const pgCode = (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  if (pgCode === '23505') {
    res.status(409).json({ error: { code: 'conflict', message: 'Cette valeur est déjà utilisée.' } });
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
