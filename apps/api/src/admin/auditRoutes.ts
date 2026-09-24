import { Router } from 'express';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { AuditEntry } from '@fsbm/shared';
import type { Db } from '../db/index.js';
import { auditLog, users } from '../db/schema.js';
import { requireAdmin } from './auth.js';

/** Consultation du journal d'audit (administrateurs). */
export function auditRouter(db: Db) {
  const router = Router();
  router.get('/audit', requireAdmin, async (req, res) => {
    const { entityType, entityId, userId } = req.query as Record<string, string | undefined>;
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);
    const filters: SQL[] = [];
    if (entityType) filters.push(eq(auditLog.entityType, entityType));
    if (entityId) filters.push(eq(auditLog.entityId, entityId));
    if (userId) filters.push(eq(auditLog.userId, userId));
    const rows = await db
      .select({ log: auditLog, name: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLog.id))
      .limit(limit)
      .offset(offset);
    const body: AuditEntry[] = rows.map(({ log, name }) => ({
      id: String(log.id),
      at: log.at.toISOString(),
      user: log.userId ? { id: log.userId, name: name ?? 'Utilisateur supprimé' } : null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      summary: log.summary,
      ip: log.ip,
    }));
    res.json(body);
  });
  return router;
}
