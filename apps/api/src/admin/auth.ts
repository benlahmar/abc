import { Router, type NextFunction, type Request, type Response } from 'express';
import { and, eq, gt, ne } from 'drizzle-orm';
import { LoginSchema, PasswordChangeSchema, type Me } from '@fsbm/shared';
import type { Db } from '../db/index.js';
import { categories, categoryMembers, sessions, users, type User } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { RateLimiter } from '../messages.js';
import { audit, requestIp } from './audit.js';
import { burnPasswordCheck, hashPassword, newSessionToken, readCookie, SESSION_COOKIE, sessionId, verifyPassword } from './security.js';
import { parseBody } from './validation.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthOptions {
  secureCookies: boolean;
  sessionTtlHours: number;
}

export const currentUser = (req: Request): AuthUser => {
  if (!req.user) throw new HttpError(401, 'unauthenticated', 'Connexion requise.');
  return req.user;
};

export function toAdminUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function loadMe(db: Db, userId: string): Promise<Me> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new HttpError(401, 'unauthenticated', 'Connexion requise.');
  const memberships = await db
    .select({ categoryId: categoryMembers.categoryId, categoryName: categories.name, role: categoryMembers.role })
    .from(categoryMembers)
    .innerJoin(categories, eq(categories.id, categoryMembers.categoryId))
    .where(eq(categoryMembers.userId, userId))
    .orderBy(categories.name);
  return { ...toAdminUser(user), memberships };
}

/** Charge l'utilisateur de la session (cookie) ; 401 sinon. */
export function authenticate(db: Db, options: AuthOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) throw new HttpError(401, 'unauthenticated', 'Connexion requise.');
    const id = sessionId(token);
    const [row] = await db
      .select({ user: users, sessionId: sessions.id })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date()), eq(users.active, true)));
    if (!row) {
      clearSessionCookie(res, options);
      throw new HttpError(401, 'unauthenticated', 'Session expirée. Veuillez vous reconnecter.');
    }
    req.user = {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      isAdmin: row.user.isAdmin,
      mustChangePassword: row.user.mustChangePassword,
      sessionId: row.sessionId,
    };
    next();
  };
}

/** Tant que le mot de passe provisoire n'est pas changé, seules quelques routes restent accessibles. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  const allowed = ['/auth/me', '/auth/password', '/auth/logout'];
  if (req.user?.mustChangePassword && !allowed.includes(req.path)) {
    throw new HttpError(403, 'password_change_required', 'Vous devez d’abord changer votre mot de passe provisoire.');
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) throw new HttpError(403, 'forbidden', 'Réservé aux administrateurs.');
  next();
}

function setSessionCookie(res: Response, token: string, options: AuthOptions) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: options.secureCookies,
    path: '/api/admin',
    maxAge: options.sessionTtlHours * 3600_000,
  });
}

function clearSessionCookie(res: Response, options: AuthOptions) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: options.secureCookies, path: '/api/admin' });
}

/** Routes publiques d'authentification (connexion) et routes de session. */
export function authRouter(db: Db, options: AuthOptions) {
  const publicRoutes = Router();
  // Seuls les échecs sont comptés : les connexions réussies d'un réseau partagé ne bloquent personne.
  const failedLogins = new RateLimiter(30, 15 * 60_000);

  publicRoutes.post('/auth/login', async (req, res) => {
    if (failedLogins.isLimited(`login:${req.ip}`)) {
      throw new HttpError(429, 'too_many_requests', 'Trop de tentatives. Réessayez dans quelques minutes.');
    }
    const { email, password } = parseBody(LoginSchema, req.body);
    const invalid = () => {
      failedLogins.take(`login:${req.ip}`);
      return new HttpError(401, 'invalid_credentials', 'Identifiants invalides ou compte temporairement verrouillé.');
    };

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || !user.active) {
      await burnPasswordCheck(password);
      await audit(db, { userId: user?.id ?? null, action: 'auth.failed', entityType: 'user', entityId: email, summary: 'Échec de connexion', ip: requestIp(req) });
      throw invalid();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await burnPasswordCheck(password);
      throw invalid();
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await db
        .update(users)
        .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil })
        .where(eq(users.id, user.id));
      await audit(db, {
        userId: user.id,
        action: lock ? 'auth.locked' : 'auth.failed',
        entityType: 'user',
        entityId: user.id,
        summary: lock ? `Compte verrouillé ${LOCK_MINUTES} min après ${MAX_FAILED_LOGINS} échecs` : 'Échec de connexion',
        ip: requestIp(req),
      });
      throw invalid();
    }

    const token = newSessionToken();
    await db.insert(sessions).values({
      id: sessionId(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + options.sessionTtlHours * 3600_000),
      ip: requestIp(req),
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    });
    await db.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await audit(db, { userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, summary: 'Connexion', ip: requestIp(req) });
    setSessionCookie(res, token, options);
    res.json(await loadMe(db, user.id));
  });

  const sessionRoutes = Router();

  sessionRoutes.get('/auth/me', async (req, res) => {
    res.json(await loadMe(db, currentUser(req).id));
  });

  sessionRoutes.post('/auth/logout', async (req, res) => {
    const user = currentUser(req);
    await db.delete(sessions).where(eq(sessions.id, user.sessionId));
    await audit(db, { userId: user.id, action: 'auth.logout', entityType: 'user', entityId: user.id, summary: 'Déconnexion', ip: requestIp(req) });
    clearSessionCookie(res, options);
    res.status(204).end();
  });

  sessionRoutes.post('/auth/password', async (req, res) => {
    const user = currentUser(req);
    const { currentPassword, newPassword } = parseBody(PasswordChangeSchema, req.body);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    if (!row || !(await verifyPassword(row.passwordHash, currentPassword))) {
      throw new HttpError(422, 'invalid_body', 'Mot de passe actuel incorrect.', { currentPassword: 'Mot de passe actuel incorrect' });
    }
    await db.update(users).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false }).where(eq(users.id, user.id));
    // Les autres sessions ouvertes sont fermées.
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, user.sessionId)));
    await audit(db, { userId: user.id, action: 'auth.password_changed', entityType: 'user', entityId: user.id, summary: 'Mot de passe modifié', ip: requestIp(req) });
    res.json(await loadMe(db, user.id));
  });

  return { publicRoutes, sessionRoutes };
}
