import { z } from 'zod';
import { categoryRoles, workflowActions, type CategoryRole, type ContentStatus, type WorkflowAction } from './workflow.js';

/* ----------------------------------------------------------------------------
   Formulaires du back-office (validés côté client et côté API)
   ---------------------------------------------------------------------------- */

export const PASSWORD_MIN_LENGTH = 10;

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(200, 'Mot de passe trop long')
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Le mot de passe doit contenir des lettres et des chiffres');

export const LoginSchema = z.object({
  email: z.email('Adresse e-mail invalide').max(200).transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Indiquez votre mot de passe').max(200),
});

export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Indiquez votre mot de passe actuel'),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, { message: 'Le nouveau mot de passe doit être différent', path: ['newPassword'] });

export const UserCreateSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom').max(120),
  email: z.email('Adresse e-mail invalide').max(200).transform((e) => e.toLowerCase()),
  password,
  isAdmin: z.boolean().default(false),
});

export const UserUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isAdmin: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const PasswordResetSchema = z.object({ password });

const slug = z
  .string()
  .trim()
  .min(2, 'Identifiant trop court')
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets uniquement (ex. vie-etudiante)');

export const CategoryInputSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom').max(80),
  slug,
  description: z.string().trim().max(500).default(''),
  requiresReview: z.boolean().default(true),
  urgentAllowed: z.boolean().default(false),
  lifetimeDays: z.number().int().min(1).max(3650).nullable().default(null),
  active: z.boolean().default(false),
});
export const CategoryUpdateSchema = CategoryInputSchema.partial();

export const MemberInputSchema = z.object({
  userId: z.uuid(),
  role: z.enum(categoryRoles),
});

const linkField = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || v === '#' || /^\/(?![/\\])/.test(v) || /^https?:\/\//.test(v), 'Lien invalide (chemin /… ou adresse http(s)://)');

export const AttachmentInputSchema = z.object({
  label: z.string().trim().min(1, 'Libellé requis').max(120),
  url: linkField.refine((v) => v !== '', 'Lien requis'),
});

export const ContentInputSchema = z
  .object({
    categoryId: z.uuid('Choisissez une catégorie'),
    title: z.string().trim().min(5, 'Le titre doit contenir au moins 5 caractères').max(250),
    excerpt: z.string().trim().max(600).default(''),
    body: z.array(z.string().trim().min(1).max(10_000)).max(100).default([]),
    image: linkField.default(''),
    attachments: z.array(AttachmentInputSchema).max(100).default([]),
    featured: z.boolean().default(false),
    /** Date et heure de publication (ISO 8601). */
    publishAt: z.iso.datetime({ offset: true, message: 'Date de publication invalide' }),
    /** Date et heure d'archivage automatique (facultative). */
    expireAt: z.iso.datetime({ offset: true, message: 'Date d’expiration invalide' }).nullable().default(null),
  })
  .refine((d) => !d.expireAt || new Date(d.expireAt) > new Date(d.publishAt), {
    message: 'La date d’expiration doit suivre la date de publication',
    path: ['expireAt'],
  });

export const ContentUpdateSchema = z.object({
  version: z.number().int().positive(),
  data: ContentInputSchema,
});

export const TransitionSchema = z.object({
  action: z.enum(workflowActions),
  comment: z.string().trim().max(2000).default(''),
  /** Version connue du client (verrouillage optimiste). */
  version: z.number().int().positive(),
});

export type LoginInput = z.input<typeof LoginSchema>;
export type PasswordChangeInput = z.input<typeof PasswordChangeSchema>;
export type UserCreateInput = z.input<typeof UserCreateSchema>;
export type UserUpdateInput = z.input<typeof UserUpdateSchema>;
export type CategoryInput = z.input<typeof CategoryInputSchema>;
export type MemberInput = z.input<typeof MemberInputSchema>;
export type ContentInput = z.input<typeof ContentInputSchema>;
export type TransitionInput = z.input<typeof TransitionSchema>;

/* ----------------------------------------------------------------------------
   Réponses de l'API d'administration
   ---------------------------------------------------------------------------- */

export interface AdminMembership {
  categoryId: string;
  categoryName: string;
  role: CategoryRole;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Me extends AdminUser {
  memberships: AdminMembership[];
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  requiresReview: boolean;
  urgentAllowed: boolean;
  lifetimeDays: number | null;
  active: boolean;
  members: Array<{ userId: string; name: string; email: string; role: CategoryRole }>;
  /** Problèmes empêchant l'activation (aucun validateur…). */
  issues: string[];
}

export interface PersonRef {
  id: string;
  name: string;
}

export interface AdminContentSummary {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  category: { id: string; name: string; slug: string };
  author: PersonRef;
  publishAt: string;
  expireAt: string | null;
  updatedAt: string;
  trashed: boolean;
  revisionOf: string | null;
  hasOpenRevision: boolean;
}

export interface AdminComment {
  id: string;
  action: string;
  message: string;
  user: PersonRef | null;
  createdAt: string;
}

export interface AdminContent extends AdminContentSummary {
  excerpt: string;
  body: string[];
  image: string;
  attachments: Array<{ label: string; url: string }>;
  featured: boolean;
  version: number;
  requiresReview: boolean;
  reviewer: PersonRef | null;
  validator: PersonRef | null;
  publishedAt: string | null;
  createdAt: string;
  comments: AdminComment[];
  /** Ce que l'utilisateur connecté peut faire. */
  permissions: { edit: boolean; actions: WorkflowAction[]; createRevision: boolean; restoreFromTrash: boolean; purge: boolean };
}

export interface AdminDashboard {
  /** Contenus qui attendent une action de l'utilisateur. */
  pending: AdminContentSummary[];
  /** Brouillons et contenus renvoyés de l'utilisateur. */
  mine: AdminContentSummary[];
  scheduled: AdminContentSummary[];
  recent: AdminContentSummary[];
  counts: Partial<Record<ContentStatus, number>>;
}

export interface AuditEntry {
  id: string;
  at: string;
  user: PersonRef | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  ip: string | null;
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
}

