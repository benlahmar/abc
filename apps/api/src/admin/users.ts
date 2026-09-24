import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { PasswordResetSchema, UserCreateSchema, UserUpdateSchema } from '@fsbm/shared';
import type { Db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { audit, requestIp } from './audit.js';
import { currentUser, requireAdmin, toAdminUser } from './auth.js';
import { hashPassword } from './security.js';
import { param, parseBody } from './validation.js';

/** Gestion des comptes (administrateurs uniquement). */
export function usersRouter(db: Db) {
  const router = Router();
  router.use('/users', requireAdmin);

  router.get('/users', async (_req, res) => {
    const rows = await db.select().from(users).orderBy(asc(users.name));
    res.json(rows.map(toAdminUser));
  });

  router.post('/users', async (req, res) => {
    const me = currentUser(req);
    const input = parseBody(UserCreateSchema, req.body);
    const [user] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, isAdmin: input.isAdmin, passwordHash: await hashPassword(input.password), mustChangePassword: true })
      .returning();
    await audit(db, { userId: me.id, action: 'user.created', entityType: 'user', entityId: user!.id, summary: `Compte créé : ${user!.name} (${user!.email})`, ip: requestIp(req) });
    res.status(201).json(toAdminUser(user!));
  });

  router.patch('/users/:id', async (req, res) => {
    const me = currentUser(req);
    const input = parseBody(UserUpdateSchema, req.body);
    if (param(req, 'id') === me.id && (input.isAdmin === false || input.active === false)) {
      throw new HttpError(409, 'conflict', 'Vous ne pouvez pas retirer vos propres droits ni désactiver votre compte.');
    }
    const [user] = await db.update(users).set(input).where(eq(users.id, param(req, 'id'))).returning();
    if (!user) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    if (input.active === false) await db.delete(sessions).where(eq(sessions.userId, user.id));
    await audit(db, { userId: me.id, action: 'user.updated', entityType: 'user', entityId: user.id, summary: `Compte modifié : ${user.name}`, details: input, ip: requestIp(req) });
    res.json(toAdminUser(user));
  });

  router.post('/users/:id/reset-password', async (req, res) => {
    const me = currentUser(req);
    const { password } = parseBody(PasswordResetSchema, req.body);
    const [user] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), mustChangePassword: true, failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, param(req, 'id')))
      .returning();
    if (!user) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await audit(db, { userId: me.id, action: 'user.password_reset', entityType: 'user', entityId: user.id, summary: `Mot de passe provisoire défini pour ${user.name}`, ip: requestIp(req) });
    res.json(toAdminUser(user));
  });

  return router;
}
