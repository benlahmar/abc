import type { Request } from 'express';
import type { Db } from '../db/index.js';
import { auditLog } from '../db/schema.js';

export interface AuditInput {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** Ajoute une ligne au journal d'audit (jamais modifié ni supprimé par l'application). */
export async function audit(db: Pick<Db, 'insert'>, entry: AuditInput) {
  await db.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
    details: entry.details ?? {},
    ip: entry.ip ?? null,
  });
}

export const requestIp = (req: Request) => req.ip ?? null;
