import type { z } from 'zod';
import { HttpError } from '../errors.js';

/** Valide un corps de requête ; en cas d'erreur, 422 avec le détail par champ. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw new HttpError(422, 'invalid_body', 'Certains champs sont invalides.', fields);
  }
  return result.data;
}

/** Paramètre d'URL obligatoire (chaîne). */
export function param(req: { params: Record<string, unknown> }, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw new HttpError(404, 'not_found', 'Ressource introuvable.');
  return value;
}
