import { appendFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { z } from 'zod';
import type { ContactMessageSchema } from '@fsbm/shared';

export type ContactPayload = Omit<z.output<typeof ContactMessageSchema>, 'website'>;

export interface StoredMessage extends ContactPayload {
  id: string;
  receivedAt: string;
}

export interface MessageStore {
  save(message: ContactPayload): Promise<StoredMessage>;
}

/**
 * Messages de contact enregistrés en JSON Lines (un message par ligne) dans storage/messages.jsonl.
 * Le back-office les listera ; l'envoi par e-mail (SMTP) pourra s'ajouter ici sans toucher aux routes.
 */
export class JsonlMessageStore implements MessageStore {
  constructor(private readonly dir: string) {}

  async save(message: ContactPayload): Promise<StoredMessage> {
    const stored: StoredMessage = { id: randomUUID(), receivedAt: new Date().toISOString(), ...message };
    await mkdir(this.dir, { recursive: true });
    await appendFile(join(this.dir, 'messages.jsonl'), `${JSON.stringify(stored)}\n`, 'utf8');
    return stored;
  }
}

/** Limiteur de débit en mémoire (fenêtre fixe par clé), suffisant pour une instance unique. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Renvoie vrai si la requête est autorisée. */
  take(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.max;
  }

  /** Vrai si la clé a dépassé la limite (sans compter cette consultation). */
  isLimited(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    return Boolean(entry && entry.resetAt > now && entry.count >= this.max);
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}
