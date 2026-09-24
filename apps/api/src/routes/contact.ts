import express, { Router } from 'express';
import { ContactMessageSchema } from '@fsbm/shared';
import { HttpError } from '../errors.js';
import { RateLimiter, type MessageStore } from '../messages.js';

/** POST /contact : validation, piège anti-robots, limite de 5 messages par IP et par tranche de 15 minutes. */
export function contactRouter(store: MessageStore, limiter = new RateLimiter(5, 15 * 60_000)): Router {
  const router = Router();

  router.post('/contact', express.json({ limit: '16kb' }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!limiter.take(req.ip ?? 'inconnu')) {
      throw new HttpError(429, 'too_many_requests', 'Trop de messages envoyés. Veuillez réessayer plus tard.');
    }

    const result = ContactMessageSchema.safeParse(req.body);
    if (!result.success) {
      // Le piège (website) rempli : on répond comme si tout allait bien, sans rien enregistrer.
      if (result.error.issues.some((issue) => issue.path[0] === 'website')) {
        res.status(201).json({ status: 'received' });
        return;
      }
      res.status(422).json({
        error: {
          code: 'invalid_message',
          message: 'Certains champs sont invalides.',
          fields: Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message])),
        },
      });
      return;
    }

    const { website: _honeypot, ...message } = result.data;
    const saved = await store.save(message);
    res.status(201).json({ status: 'received', id: saved.id });
  });

  return router;
}
