import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, ilike, inArray, isNotNull, isNull, lte, sql, type SQL } from 'drizzle-orm';
import {
  actionLabels,
  actionsRequiringComment,
  allowedActions,
  canEdit,
  ContentInputSchema,
  ContentUpdateSchema,
  contentStatuses,
  nextStatus,
  TransitionSchema,
  type AdminContent,
  type AdminContentSummary,
  type AdminDashboard,
  type CategoryRole,
  type ContentStatus,
  type WorkflowAction,
} from '@fsbm/shared';
import type { Db } from '../db/index.js';
import { categories, categoryMembers, contentComments, contents, users, type Category, type Content } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { audit, requestIp } from './audit.js';
import { currentUser, type AuthUser } from './auth.js';
import { categoryIssues } from './categories.js';
import { param, parseBody } from './validation.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

/* ---------------------------------------------------------------------------
   Rôles et visibilité
   --------------------------------------------------------------------------- */

async function membershipMap(db: Executor, userId: string) {
  const rows = await db.select().from(categoryMembers).where(eq(categoryMembers.userId, userId));
  const map = new Map<string, CategoryRole[]>();
  for (const row of rows) map.set(row.categoryId, [...(map.get(row.categoryId) ?? []), row.role]);
  return map;
}

/** Catégories visibles : toutes pour un administrateur, sinon celles où l'utilisateur a un rôle. */
async function visibleCategoryIds(db: Executor, user: AuthUser): Promise<string[] | null> {
  if (user.isAdmin) return null;
  return [...(await membershipMap(db, user.id)).keys()];
}

function slugify(title: string) {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
  return `${base || 'contenu'}-${randomBytes(3).toString('hex')}`;
}

/* ---------------------------------------------------------------------------
   Lecture
   --------------------------------------------------------------------------- */

type SummaryRow = { content: Content; category: Category; authorName: string };

async function selectSummaries(db: Executor, where: SQL | undefined, limit = 200): Promise<AdminContentSummary[]> {
  const rows: SummaryRow[] = await db
    .select({ content: contents, category: categories, authorName: users.name })
    .from(contents)
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .innerJoin(users, eq(users.id, contents.authorId))
    .where(where)
    .orderBy(desc(contents.updatedAt))
    .limit(limit);
  const ids = rows.map((r) => r.content.id);
  const revised = ids.length
    ? new Set(
        (await db.select({ of: contents.revisionOf }).from(contents).where(inArray(contents.revisionOf, ids))).map((r) => r.of),
      )
    : new Set<string | null>();
  return rows.map(({ content, category, authorName }) => ({
    id: content.id,
    slug: content.slug,
    title: content.title,
    status: content.status,
    category: { id: category.id, name: category.name, slug: category.slug },
    author: { id: content.authorId, name: authorName },
    publishAt: content.publishAt.toISOString(),
    expireAt: content.expireAt?.toISOString() ?? null,
    updatedAt: content.updatedAt.toISOString(),
    trashed: content.trashedAt !== null,
    revisionOf: content.revisionOf,
    hasOpenRevision: revised.has(content.id),
  }));
}

const visibleWhere = (ids: string[] | null): SQL | undefined =>
  ids === null ? undefined : ids.length ? inArray(contents.categoryId, ids) : sql`false`;

async function loadRaw(db: Executor, id: string) {
  const [row] = await db
    .select({ content: contents, category: categories })
    .from(contents)
    .innerJoin(categories, eq(categories.id, contents.categoryId))
    .where(eq(contents.id, id));
  if (!row) throw new HttpError(404, 'not_found', 'Contenu introuvable.');
  return row;
}

async function ensureVisible(db: Executor, user: AuthUser, categoryId: string) {
  const ids = await visibleCategoryIds(db, user);
  if (ids !== null && !ids.includes(categoryId)) throw new HttpError(404, 'not_found', 'Contenu introuvable.');
}

export async function loadContent(db: Executor, user: AuthUser, id: string): Promise<AdminContent> {
  const { content, category } = await loadRaw(db, id);
  await ensureVisible(db, user, category.id);
  const [summary] = await selectSummaries(db, eq(contents.id, id), 1);
  const people = [content.reviewerId, content.validatorId].filter((v): v is string => Boolean(v));
  const names = people.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, people)) : [];
  const person = (pid: string | null) => (pid ? { id: pid, name: names.find((n) => n.id === pid)?.name ?? 'Utilisateur supprimé' } : null);
  const comments = await db
    .select({ comment: contentComments, name: users.name })
    .from(contentComments)
    .leftJoin(users, eq(users.id, contentComments.userId))
    .where(eq(contentComments.contentId, id))
    .orderBy(contentComments.createdAt);

  const roles = (await membershipMap(db, user.id)).get(category.id) ?? [];
  const engine = {
    status: content.status,
    authorId: content.authorId,
    reviewerId: content.reviewerId,
    requiresReview: content.requiresReview,
    urgentAllowed: category.urgentAllowed,
    trashed: content.trashedAt !== null,
  };
  const actor = { id: user.id, isAdmin: user.isAdmin, roles };
  const trashed = content.trashedAt !== null;

  return {
    ...summary!,
    excerpt: content.excerpt,
    body: content.body,
    image: content.image,
    attachments: content.attachments,
    featured: content.featured,
    version: content.version,
    requiresReview: content.requiresReview,
    reviewer: person(content.reviewerId),
    validator: person(content.validatorId),
    publishedAt: content.publishedAt?.toISOString() ?? null,
    createdAt: content.createdAt.toISOString(),
    comments: comments.map(({ comment, name }) => ({
      id: comment.id,
      action: comment.action,
      message: comment.message,
      user: comment.userId ? { id: comment.userId, name: name ?? 'Utilisateur supprimé' } : null,
      createdAt: comment.createdAt.toISOString(),
    })),
    permissions: {
      edit: canEdit(engine, actor),
      actions: allowedActions(engine, actor),
      createRevision: content.status === 'published' && !content.revisionOf && !summary!.hasOpenRevision && roles.includes('redacteur') && !trashed,
      restoreFromTrash: user.isAdmin && trashed,
      purge: user.isAdmin && trashed && content.status !== 'published',
    },
  };
}

/* ---------------------------------------------------------------------------
   Écriture
   --------------------------------------------------------------------------- */

async function requireActiveCategoryRole(db: Executor, user: AuthUser, categoryId: string, role: CategoryRole) {
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!category) throw new HttpError(422, 'invalid_body', 'Catégorie inconnue.', { categoryId: 'Catégorie inconnue' });
  if (!category.active) throw new HttpError(422, 'invalid_body', 'Cette catégorie n’est pas active.', { categoryId: 'Catégorie inactive' });
  const roles = (await membershipMap(db, user.id)).get(categoryId) ?? [];
  if (!roles.includes(role)) throw new HttpError(403, 'forbidden', 'Vous n’êtes pas rédacteur dans cette catégorie.');
  return category;
}

const fromInput = (input: ReturnType<typeof ContentInputSchema.parse>) => ({
  categoryId: input.categoryId,
  title: input.title,
  excerpt: input.excerpt,
  body: input.body,
  image: input.image,
  attachments: input.attachments,
  featured: input.featured,
  publishAt: new Date(input.publishAt),
  expireAt: input.expireAt ? new Date(input.expireAt) : null,
});

/** Applique une révision validée à l'original, puis la supprime (commentaires rattachés à l'original). */
async function mergeRevision(tx: Executor, revision: Content) {
  const originalId = revision.revisionOf!;
  await tx
    .update(contents)
    .set({
      title: revision.title,
      excerpt: revision.excerpt,
      body: revision.body,
      image: revision.image,
      attachments: revision.attachments,
      featured: revision.featured,
      publishAt: revision.publishAt,
      expireAt: revision.expireAt,
      reviewerId: revision.reviewerId,
      validatorId: revision.validatorId,
      version: sql`${contents.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(contents.id, originalId));
  await tx.update(contentComments).set({ contentId: originalId }).where(eq(contentComments.contentId, revision.id));
  await tx.delete(contents).where(eq(contents.id, revision.id));
  return originalId;
}

/** Exécute une action du circuit. Renvoie l'identifiant du contenu résultant (l'original si une révision a été fusionnée). */
async function transition(db: Db, user: AuthUser, id: string, action: WorkflowAction, comment: string, version: number, ip: string | null) {
  return db.transaction(async (tx) => {
    const { content, category } = await loadRaw(tx, id);
    await ensureVisible(tx, user, category.id);
    if (content.version !== version) throw new HttpError(409, 'stale', 'Ce contenu a été modifié entre-temps. Rechargez la page.');

    const roles = (await membershipMap(tx, user.id)).get(category.id) ?? [];
    const engine = {
      status: content.status,
      authorId: content.authorId,
      reviewerId: content.reviewerId,
      requiresReview: action === 'submit' ? category.requiresReview : content.requiresReview,
      urgentAllowed: category.urgentAllowed,
      trashed: content.trashedAt !== null,
    };
    if (!allowedActions(engine, { id: user.id, isAdmin: user.isAdmin, roles }).includes(action)) {
      throw new HttpError(403, 'forbidden', `Action « ${actionLabels[action]} » non autorisée pour vous à ce stade.`);
    }
    if (actionsRequiringComment.includes(action) && !comment) {
      throw new HttpError(422, 'invalid_body', 'Un commentaire est obligatoire pour cette action.', { comment: 'Commentaire obligatoire' });
    }

    if (action === 'submit') {
      if (!category.active) throw new HttpError(409, 'conflict', 'La catégorie est inactive : soumission impossible.');
      const members = await tx.select({ role: categoryMembers.role }).from(categoryMembers).where(eq(categoryMembers.categoryId, category.id));
      const issues = categoryIssues(category, members);
      if (issues.length) throw new HttpError(409, 'conflict', `Circuit incomplet dans la catégorie : ${issues.join(', ').toLowerCase()}.`);
    }

    const now = new Date();
    const status: ContentStatus = nextStatus(action, engine, content.publishAt, now);
    const patch: Partial<Content> & { version: number; updatedAt: Date } = { status, version: content.version + 1, updatedAt: now };
    switch (action) {
      case 'submit':
        Object.assign(patch, { requiresReview: category.requiresReview, reviewerId: null, validatorId: null });
        break;
      case 'approve_review':
        patch.reviewerId = user.id;
        break;
      case 'validate':
      case 'publish_urgent':
        patch.validatorId = user.id;
        if (status === 'published') patch.publishedAt = now;
        break;
      case 'restore':
        patch.publishedAt = content.publishedAt ?? now;
        break;
      case 'reopen':
        Object.assign(patch, { reviewerId: null, validatorId: null });
        break;
      case 'trash':
        patch.trashedAt = now;
        break;
    }

    const [updated] = await tx.update(contents).set(patch).where(and(eq(contents.id, id), eq(contents.version, version))).returning();
    if (!updated) throw new HttpError(409, 'stale', 'Ce contenu a été modifié entre-temps. Rechargez la page.');
    await tx.insert(contentComments).values({ contentId: id, userId: user.id, action, message: comment });
    await audit(tx, {
      userId: user.id,
      action: `content.${action}`,
      entityType: 'content',
      entityId: content.revisionOf ?? id,
      summary: `« ${content.title} » : ${actionLabels[action]}${content.revisionOf ? ' (révision)' : ''}`,
      details: { from: content.status, to: status, comment: comment || undefined },
      ip,
    });

    if (updated.status === 'published' && updated.revisionOf) return mergeRevision(tx, updated);
    return id;
  });
}

/* ---------------------------------------------------------------------------
   Publication et archivage automatiques
   --------------------------------------------------------------------------- */

/** Publie les contenus programmés arrivés à échéance et archive ceux qui ont expiré. */
export async function runScheduledTransitions(db: Db, now = new Date()) {
  const due = await db.select().from(contents).where(and(eq(contents.status, 'scheduled'), lte(contents.publishAt, now), isNull(contents.trashedAt)));
  for (const item of due) {
    await db.transaction(async (tx) => {
      const [published] = await tx
        .update(contents)
        .set({ status: 'published', publishedAt: now, version: item.version + 1, updatedAt: now })
        .where(and(eq(contents.id, item.id), eq(contents.status, 'scheduled')))
        .returning();
      if (!published) return;
      await audit(tx, { userId: null, action: 'content.published_auto', entityType: 'content', entityId: item.revisionOf ?? item.id, summary: `« ${item.title} » publié automatiquement` });
      if (published.revisionOf) await mergeRevision(tx, published);
    });
  }
  const expired = await db
    .update(contents)
    .set({ status: 'archived', updatedAt: now, version: sql`${contents.version} + 1` })
    .where(and(eq(contents.status, 'published'), isNotNull(contents.expireAt), lte(contents.expireAt, now)))
    .returning({ id: contents.id, title: contents.title });
  for (const item of expired) {
    await audit(db, { userId: null, action: 'content.archived_auto', entityType: 'content', entityId: item.id, summary: `« ${item.title} » archivé automatiquement (expiration)` });
  }
  return { published: due.length, archived: expired.length };
}

/* ---------------------------------------------------------------------------
   Routes
   --------------------------------------------------------------------------- */

export function contentsRouter(db: Db) {
  const router = Router();

  router.get('/dashboard', async (req, res) => {
    const me = currentUser(req);
    const memberships = await membershipMap(db, me.id);
    const idsWith = (role: CategoryRole) => [...memberships].filter(([, roles]) => roles.includes(role)).map(([id]) => id);
    const visible = visibleWhere(await visibleCategoryIds(db, me));
    const active = isNull(contents.trashedAt);
    const reviewIds = idsWith('verificateur');
    const validationIds = idsWith('validateur');

    const pendingParts: SQL[] = [and(eq(contents.status, 'changes_requested'), eq(contents.authorId, me.id))!];
    if (reviewIds.length) pendingParts.push(and(eq(contents.status, 'in_review'), inArray(contents.categoryId, reviewIds), sql`${contents.authorId} <> ${me.id}`)!);
    if (validationIds.length) {
      pendingParts.push(
        and(
          eq(contents.status, 'in_validation'),
          inArray(contents.categoryId, validationIds),
          sql`${contents.authorId} <> ${me.id}`,
          sql`${contents.reviewerId} IS DISTINCT FROM ${me.id}`,
        )!,
      );
    }

    const counts = await db
      .select({ status: contents.status, n: sql<number>`count(*)::int` })
      .from(contents)
      .where(and(visible, active))
      .groupBy(contents.status);

    const body: AdminDashboard = {
      pending: await selectSummaries(db, and(active, sql`(${sql.join(pendingParts, sql` OR `)})`), 50),
      mine: await selectSummaries(db, and(active, eq(contents.authorId, me.id), inArray(contents.status, ['draft', 'changes_requested'])), 20),
      scheduled: await selectSummaries(db, and(active, visible, eq(contents.status, 'scheduled')), 20),
      recent: await selectSummaries(db, and(active, visible, eq(contents.status, 'published')), 8),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    };
    res.json(body);
  });

  router.get('/contents', async (req, res) => {
    const me = currentUser(req);
    const { status, category, q, mine } = req.query as Record<string, string | undefined>;
    const filters: Array<SQL | undefined> = [visibleWhere(await visibleCategoryIds(db, me))];
    if (status === 'trash') filters.push(isNotNull(contents.trashedAt));
    else {
      filters.push(isNull(contents.trashedAt));
      if (status && (contentStatuses as readonly string[]).includes(status)) filters.push(eq(contents.status, status as ContentStatus));
    }
    if (category) filters.push(eq(contents.categoryId, category));
    if (q) filters.push(ilike(contents.title, `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
    if (mine === '1') filters.push(eq(contents.authorId, me.id));
    res.json(await selectSummaries(db, and(...filters)));
  });

  router.get('/contents/:id', async (req, res) => {
    res.json(await loadContent(db, currentUser(req), param(req, 'id')));
  });

  router.post('/contents', async (req, res) => {
    const me = currentUser(req);
    const input = parseBody(ContentInputSchema, req.body);
    await requireActiveCategoryRole(db, me, input.categoryId, 'redacteur');
    const [created] = await db
      .insert(contents)
      .values({ ...fromInput(input), slug: slugify(input.title), authorId: me.id, status: 'draft' })
      .returning();
    await audit(db, { userId: me.id, action: 'content.created', entityType: 'content', entityId: created!.id, summary: `« ${created!.title} » créé (brouillon)`, ip: requestIp(req) });
    res.status(201).json(await loadContent(db, me, created!.id));
  });

  router.patch('/contents/:id', async (req, res) => {
    const me = currentUser(req);
    const { version, data } = parseBody(ContentUpdateSchema, req.body);
    const detail = await loadContent(db, me, param(req, 'id'));
    if (!detail.permissions.edit) throw new HttpError(403, 'forbidden', 'Vous ne pouvez pas modifier ce contenu à ce stade du circuit.');
    if (data.categoryId !== detail.category.id) {
      if (detail.revisionOf || !['draft', 'changes_requested'].includes(detail.status)) {
        throw new HttpError(422, 'invalid_body', 'La catégorie ne peut plus être changée.', { categoryId: 'Catégorie verrouillée' });
      }
      await requireActiveCategoryRole(db, me, data.categoryId, 'redacteur');
    }
    const [updated] = await db
      .update(contents)
      .set({ ...fromInput(data), version: version + 1, updatedAt: new Date() })
      .where(and(eq(contents.id, detail.id), eq(contents.version, version)))
      .returning();
    if (!updated) throw new HttpError(409, 'stale', 'Ce contenu a été modifié entre-temps. Rechargez la page.');
    await audit(db, { userId: me.id, action: 'content.updated', entityType: 'content', entityId: detail.revisionOf ?? detail.id, summary: `« ${updated.title} » modifié`, ip: requestIp(req) });
    res.json(await loadContent(db, me, detail.id));
  });

  router.post('/contents/:id/transitions', async (req, res) => {
    const me = currentUser(req);
    const { action, comment, version } = parseBody(TransitionSchema, req.body);
    const resultId = await transition(db, me, param(req, 'id'), action, comment, version, requestIp(req));
    res.json(await loadContent(db, me, resultId));
  });

  /** Révision d'un contenu publié : copie de travail qui refait le circuit ; l'original reste en ligne. */
  router.post('/contents/:id/revision', async (req, res) => {
    const me = currentUser(req);
    const detail = await loadContent(db, me, param(req, 'id'));
    if (!detail.permissions.createRevision) throw new HttpError(409, 'conflict', 'Révision impossible (contenu non publié, révision déjà ouverte ou droits insuffisants).');
    const { content } = await loadRaw(db, detail.id);
    const [revision] = await db
      .insert(contents)
      .values({
        slug: `${content.slug}-revision-${randomBytes(3).toString('hex')}`,
        categoryId: content.categoryId,
        title: content.title,
        excerpt: content.excerpt,
        body: content.body,
        image: content.image,
        attachments: content.attachments,
        featured: content.featured,
        publishAt: content.publishAt,
        expireAt: content.expireAt,
        authorId: me.id,
        status: 'draft',
        revisionOf: content.id,
      })
      .returning();
    await audit(db, { userId: me.id, action: 'content.revision_created', entityType: 'content', entityId: content.id, summary: `« ${content.title} » : révision ouverte`, ip: requestIp(req) });
    res.status(201).json(await loadContent(db, me, revision!.id));
  });

  router.post('/contents/:id/restore', async (req, res) => {
    const me = currentUser(req);
    const detail = await loadContent(db, me, param(req, 'id'));
    if (!detail.permissions.restoreFromTrash) throw new HttpError(403, 'forbidden', 'Restauration réservée aux administrateurs.');
    await db.update(contents).set({ trashedAt: null, updatedAt: new Date(), version: detail.version + 1 }).where(eq(contents.id, detail.id));
    await audit(db, { userId: me.id, action: 'content.restored', entityType: 'content', entityId: detail.id, summary: `« ${detail.title} » restauré depuis la corbeille`, ip: requestIp(req) });
    res.json(await loadContent(db, me, detail.id));
  });

  router.delete('/contents/:id', async (req, res) => {
    const me = currentUser(req);
    const detail = await loadContent(db, me, param(req, 'id'));
    if (!detail.permissions.purge) throw new HttpError(403, 'forbidden', 'Seul un administrateur peut supprimer définitivement un contenu de la corbeille.');
    await db.delete(contents).where(eq(contents.id, detail.id));
    await audit(db, { userId: me.id, action: 'content.purged', entityType: 'content', entityId: detail.id, summary: `« ${detail.title} » supprimé définitivement`, ip: requestIp(req) });
    res.status(204).end();
  });

  return router;
}
