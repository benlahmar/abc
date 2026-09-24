import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors.js';

/** Hachage Argon2id (paramètres par défaut de @node-rs/argon2, conformes aux recommandations OWASP). */
export const hashPassword = (password: string) => hash(password);
export const verifyPassword = async (passwordHash: string, password: string) => {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
};

/** Empreinte factice : vérifiée quand l'utilisateur n'existe pas, pour un temps de réponse constant. */
let dummyHash: Promise<string> | null = null;
export const burnPasswordCheck = async (password: string) => {
  dummyHash ??= hashPassword('fsbm-dummy-password-0');
  await verifyPassword(await dummyHash, password);
};

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const sessionId = (token: string) => createHash('sha256').update(token).digest('hex');

export const SESSION_COOKIE = 'fsbm_admin';
export const CSRF_HEADER = 'x-fsbm-csrf';

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Protection CSRF des requêtes d'écriture : cookie SameSite=Strict, en-tête personnalisé obligatoire
 * (impossible à envoyer depuis un autre site sans autorisation CORS) et contrôle de l'origine.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.get(CSRF_HEADER) !== '1') throw new HttpError(403, 'csrf', 'Requête refusée (en-tête de sécurité manquant).');
  const origin = req.get('origin');
  if (origin) {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      throw new HttpError(403, 'csrf', 'Origine invalide.');
    }
    if (host !== req.get('host')) throw new HttpError(403, 'csrf', 'Origine non autorisée.');
  }
  next();
}
