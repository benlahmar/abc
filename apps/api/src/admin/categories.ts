import { Router } from 'express';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { CategoryInputSchema, CategoryUpdateSchema, MemberInputSchema, roleLabels, type AdminCategory, type CategoryRole } from '@fsbm/shared';
import type { Db } from '../db/index.js';
import { categories, categoryMembers, users, type Category } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { audit, requestIp } from './audit.js';
import { currentUser, requireAdmin } from './auth.js';
import { param, parseBody } from './validation.js';

type Member = AdminCategory['members'][number];

/** Problèmes qui empêchent une catégorie de fonctionner (et donc d'être activée). */
export function categoryIssues(category: Pick<Category, 'requiresReview'>, members: Array<{ role: CategoryRole }>): string[] {
  const count = (role: CategoryRole) => members.filter((m) => m.role === role).length;
  const issues: string[] = [];
  if (count('redacteur') === 0) issues.push('Aucun rédacteur');
  if (category.requiresReview && count('verificateur') === 0) issues.push('Aucun vérificateur (la vérification est requise)');
  if (count('validateur') === 0) issues.push('Aucun validateur');
  return issues;
}

export async function loadCategories(db: Db, ids?: string[]): Promise<AdminCategory[]> {
  if (ids && ids.length === 0) return [];
  const rows = await db
    .select()
    .from(categories)
    .where(ids ? inArray(categories.id, ids) : undefined)
    .orderBy(asc(categories.name));
  const members = await db
    .select({ categoryId: categoryMembers.categoryId, userId: users.id, name: users.name, email: users.email, role: categoryMembers.role })
    .from(categoryMembers)
    .innerJoin(users, eq(users.id, categoryMembers.userId))
    .orderBy(asc(users.name));
  return rows.map((c) => {
    const list: Member[] = members.filter((m) => m.categoryId === c.id).map(({ categoryId: _c, ...m }) => m);
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      requiresReview: c.requiresReview,
      urgentAllowed: c.urgentAllowed,
      lifetimeDays: c.lifetimeDays,
      active: c.active,
      members: list,
      issues: categoryIssues(c, list),
    };
  });
}

async function loadOne(db: Db, id: string) {
  const [category] = await loadCategories(db, [id]);
  if (!category) throw new HttpError(404, 'not_found', 'Catégorie introuvable.');
  return category;
}

export function categoriesRouter(db: Db) {
  const router = Router();

  // Les utilisateurs non administrateurs ne voient que leurs catégories.
  router.get('/categories', async (req, res) => {
    const me = currentUser(req);
    if (me.isAdmin) return void res.json(await loadCategories(db));
    const mine = await db.selectDistinct({ id: categoryMembers.categoryId }).from(categoryMembers).where(eq(categoryMembers.userId, me.id));
    res.json(await loadCategories(db, mine.map((m) => m.id)));
  });

  router.post('/categories', requireAdmin, async (req, res) => {
    const me = currentUser(req);
    const input = parseBody(CategoryInputSchema, req.body);
    if (input.active) throw new HttpError(422, 'invalid_body', 'Affectez d’abord un rédacteur et un validateur avant d’activer la catégorie.', { active: 'Catégorie sans membres' });
    const [category] = await db.insert(categories).values(input).returning();
    await audit(db, { userId: me.id, action: 'category.created', entityType: 'category', entityId: category!.id, summary: `Catégorie créée : ${category!.name}`, ip: requestIp(req) });
    res.status(201).json(await loadOne(db, category!.id));
  });

  router.patch('/categories/:id', requireAdmin, async (req, res) => {
    const me = currentUser(req);
    const input = parseBody(CategoryUpdateSchema, req.body);
    const current = await loadOne(db, param(req, 'id'));
    const next = { ...current, ...input };
    if (next.active) {
      const issues = categoryIssues(next, current.members);
      if (issues.length) throw new HttpError(422, 'invalid_body', `Impossible d’activer la catégorie : ${issues.join(', ').toLowerCase()}.`, { active: issues.join(' ; ') });
    }
    await db.update(categories).set({ ...input, updatedAt: new Date() }).where(eq(categories.id, current.id));
    await audit(db, { userId: me.id, action: 'category.updated', entityType: 'category', entityId: current.id, summary: `Catégorie modifiée : ${next.name}`, details: input, ip: requestIp(req) });
    res.json(await loadOne(db, current.id));
  });

  router.post('/categories/:id/members', requireAdmin, async (req, res) => {
    const me = currentUser(req);
    const { userId, role } = parseBody(MemberInputSchema, req.body);
    const category = await loadOne(db, param(req, 'id'));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new HttpError(404, 'not_found', 'Utilisateur introuvable.');
    await db.insert(categoryMembers).values({ categoryId: category.id, userId, role }).onConflictDoNothing();
    await audit(db, { userId: me.id, action: 'category.member_added', entityType: 'category', entityId: category.id, summary: `${user.name} : ${roleLabels[role]} (${category.name})`, ip: requestIp(req) });
    res.status(201).json(await loadOne(db, category.id));
  });

  router.delete('/categories/:id/members/:userId/:role', requireAdmin, async (req, res) => {
    const me = currentUser(req);
    const category = await loadOne(db, param(req, 'id'));
    const role = param(req, 'role') as CategoryRole;
    const remaining = category.members.filter((m) => !(m.userId === param(req, 'userId') && m.role === role));
    if (category.active && categoryIssues(category, remaining).length) {
      throw new HttpError(409, 'conflict', 'Ce retrait laisserait la catégorie active sans responsable. Ajoutez d’abord un remplaçant ou désactivez la catégorie.');
    }
    const removed = await db
      .delete(categoryMembers)
      .where(and(eq(categoryMembers.categoryId, category.id), eq(categoryMembers.userId, param(req, 'userId')), eq(categoryMembers.role, role)))
      .returning();
    if (!removed.length) throw new HttpError(404, 'not_found', 'Affectation introuvable.');
    const member = category.members.find((m) => m.userId === param(req, 'userId'));
    await audit(db, { userId: me.id, action: 'category.member_removed', entityType: 'category', entityId: category.id, summary: `${member?.name ?? 'Utilisateur'} retiré : ${roleLabels[role] ?? role} (${category.name})`, ip: requestIp(req) });
    res.json(await loadOne(db, category.id));
  });

  return router;
}
