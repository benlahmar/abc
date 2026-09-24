import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { asc, count, eq } from 'drizzle-orm';
import { NewsSchema } from '@fsbm/shared';
import type { Db } from './db/index.js';
import { categories, contents, users } from './db/schema.js';
import { hashPassword } from './admin/security.js';
import { audit } from './admin/audit.js';

/** Catégories de départ (inactives tant que leurs rôles ne sont pas affectés). */
export const defaultCategories = [
  { slug: 'recherche', name: 'Recherche', description: 'Actualités scientifiques, laboratoires, conférences, soutenances.', requiresReview: true },
  { slug: 'scolarite', name: 'Scolarité', description: 'Inscriptions, listes d’admis, examens, résultats, emplois du temps.', requiresReview: false },
  { slug: 'institutionnel', name: 'Institutionnelle', description: 'Communications officielles du décanat et de la Faculté.', requiresReview: true },
];

/** Correspondance des anciennes catégories du fichier news.json. */
const legacyCategory: Record<string, string> = { recherche: 'recherche', campus: 'scolarite', services: 'scolarite' };

export async function ensureDefaultCategories(db: Db) {
  const [{ n }] = (await db.select({ n: count() }).from(categories)) as [{ n: number }];
  if (n > 0) return false;
  await db.insert(categories).values(defaultCategories);
  return true;
}

/** Premier administrateur, créé à partir de ADMIN_EMAIL / ADMIN_PASSWORD si la base n'a aucun compte. */
export async function ensureFirstAdmin(db: Db, env: { email?: string; password?: string; name?: string }) {
  const [{ n }] = (await db.select({ n: count() }).from(users)) as [{ n: number }];
  if (n > 0 || !env.email || !env.password) return null;
  const [admin] = await db
    .insert(users)
    .values({
      email: env.email.toLowerCase(),
      name: env.name || 'Administrateur',
      passwordHash: await hashPassword(env.password),
      isAdmin: true,
      mustChangePassword: true,
    })
    .returning();
  await audit(db, { userId: null, action: 'user.bootstrap', entityType: 'user', entityId: admin!.id, summary: `Premier administrateur créé : ${admin!.email}` });
  return admin!;
}

/** Importe une fois les actualités de data/news.json (publiées, adresses conservées). */
export async function importLegacyNews(db: Db, dataDir: string) {
  const file = join(dataDir, 'news.json');
  if (!existsSync(file)) return 0;
  const [{ n }] = (await db.select({ n: count() }).from(contents)) as [{ n: number }];
  if (n > 0) return 0;
  const [author] = await db.select().from(users).where(eq(users.isAdmin, true)).orderBy(asc(users.createdAt)).limit(1);
  if (!author) return 0;
  const news = NewsSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  const cats = await db.select().from(categories);
  const bySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const fallback = bySlug.get('institutionnel') ?? cats[0]?.id;
  if (!fallback) return 0;
  for (const item of news.items) {
    const publishAt = new Date(`${item.date}T09:00:00+01:00`);
    await db.insert(contents).values({
      slug: item.id,
      categoryId: bySlug.get(legacyCategory[item.category] ?? item.category) ?? fallback,
      title: item.title,
      excerpt: item.excerpt,
      body: item.body,
      image: item.image,
      attachments: item.attachments,
      featured: item.featured,
      status: 'published',
      publishAt,
      publishedAt: publishAt,
      authorId: author.id,
      validatorId: author.id,
    });
  }
  await audit(db, { userId: null, action: 'content.imported', entityType: 'content', entityId: 'news.json', summary: `${news.items.length} actualités importées depuis news.json` });
  return news.items.length;
}

export async function bootstrap(db: Db, options: { dataDir: string; admin: { email?: string; password?: string; name?: string } }) {
  await ensureDefaultCategories(db);
  const admin = await ensureFirstAdmin(db, options.admin);
  const imported = await importLegacyNews(db, options.dataDir);
  return { admin, imported };
}
