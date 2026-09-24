import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { NewsCategory, NewsDetail, NewsItem, NewsPage } from '@fsbm/shared';
import type { Db } from './db/index.js';
import { categories, contents, type Category, type Content } from './db/schema.js';

/** Date publique (AAAA-MM-JJ) dans le fuseau de Casablanca. */
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' });

const toNewsItem = (content: Content, category: Category): NewsItem => ({
  id: content.slug,
  title: content.title,
  excerpt: content.excerpt,
  body: content.body,
  category: category.slug,
  date: dayFormat.format(content.publishAt),
  image: content.image,
  url: `/actualites/${content.slug}`,
  featured: content.featured,
  attachments: content.attachments,
});

/** Seuls les contenus publiés, dont la date est passée, hors corbeille et hors révisions, sont publics. */
const publicWhere = () =>
  and(eq(contents.type, 'news'), eq(contents.status, 'published'), lte(contents.publishAt, new Date()), isNull(contents.trashedAt), isNull(contents.revisionOf));

/** Actualités publiques, lues dans la base alimentée par le back-office. */
export class NewsService {
  constructor(private readonly db: Db) {}

  private async publicCategories(): Promise<{ list: NewsCategory[]; counts: Record<string, number> }> {
    const rows = await this.db
      .select({ slug: categories.slug, name: categories.name, n: sql<number>`count(*)::int` })
      .from(contents)
      .innerJoin(categories, eq(categories.id, contents.categoryId))
      .where(publicWhere())
      .groupBy(categories.slug, categories.name)
      .orderBy(asc(categories.name));
    const counts: Record<string, number> = { all: rows.reduce((sum, r) => sum + r.n, 0) };
    for (const r of rows) counts[r.slug] = r.n;
    return { list: rows.map((r) => ({ id: r.slug, label: r.name })), counts };
  }

  async page(options: { category?: string; limit: number; offset: number }): Promise<NewsPage> {
    const { list, counts } = await this.publicCategories();
    const categoryFilter = options.category
      ? inArray(contents.categoryId, this.db.select({ id: categories.id }).from(categories).where(eq(categories.slug, options.category)))
      : undefined;
    const rows = await this.db
      .select({ content: contents, category: categories })
      .from(contents)
      .innerJoin(categories, eq(categories.id, contents.categoryId))
      .where(and(publicWhere(), categoryFilter))
      .orderBy(desc(contents.publishAt))
      .limit(options.limit)
      .offset(options.offset);
    return {
      categories: list,
      counts,
      items: rows.map((r) => toNewsItem(r.content, r.category)),
      total: options.category ? (counts[options.category] ?? 0) : counts.all ?? 0,
      limit: options.limit,
      offset: options.offset,
    };
  }

  async bySlug(slug: string): Promise<NewsDetail | null> {
    const [row] = await this.db
      .select({ content: contents, category: categories })
      .from(contents)
      .innerJoin(categories, eq(categories.id, contents.categoryId))
      .where(and(publicWhere(), eq(contents.slug, slug)));
    if (!row) return null;
    return { item: toNewsItem(row.content, row.category), category: { id: row.category.slug, label: row.category.name } };
  }

  /** Format de la collection « news » (compatibilité avec GET /api/v1/news complet). */
  async collection() {
    const page = await this.page({ limit: 500, offset: 0 });
    return { categories: page.categories, items: page.items };
  }
}
