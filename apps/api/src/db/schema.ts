import { bigserial, boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { CategoryRole, ContentStatus } from '@fsbm/shared';

/** Tables Drizzle — reflet exact de migrations/*.sql (source de vérité du schéma). */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  active: boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  requiresReview: boolean('requires_review').notNull().default(true),
  urgentAllowed: boolean('urgent_allowed').notNull().default(false),
  lifetimeDays: integer('lifetime_days'),
  active: boolean('active').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const categoryMembers = pgTable(
  'category_members',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<CategoryRole>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.userId, t.role] })],
);

export type Attachment = { label: string; url: string };

export const contents = pgTable('contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull().default('news'),
  slug: text('slug').notNull().unique(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull().default(''),
  body: jsonb('body').$type<string[]>().notNull().default([]),
  image: text('image').notNull().default(''),
  attachments: jsonb('attachments').$type<Attachment[]>().notNull().default([]),
  featured: boolean('featured').notNull().default(false),
  status: text('status').$type<ContentStatus>().notNull().default('draft'),
  requiresReview: boolean('requires_review').notNull().default(true),
  publishAt: ts('publish_at').notNull().defaultNow(),
  expireAt: ts('expire_at'),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  validatorId: uuid('validator_id').references(() => users.id),
  revisionOf: uuid('revision_of'),
  version: integer('version').notNull().default(1),
  trashedAt: ts('trashed_at'),
  publishedAt: ts('published_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const contentComments = pgTable('content_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id')
    .notNull()
    .references(() => contents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  message: text('message').notNull().default(''),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  at: ts('at').notNull().defaultNow(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  summary: text('summary').notNull().default(''),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  ip: text('ip'),
});

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Content = typeof contents.$inferSelect;
