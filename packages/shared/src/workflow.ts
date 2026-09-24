/**
 * Circuit de publication des contenus.
 *
 * Chaque contenu appartient à une catégorie (Recherche, Scolarité, Institutionnelle…).
 * La catégorie définit qui rédige, vérifie et valide, et si l'étape de vérification est requise.
 * Ce module est la source de vérité des règles : l'API les applique, le back-office les affiche.
 */

export const contentStatuses = [
  'draft',
  'changes_requested',
  'in_review',
  'in_validation',
  'scheduled',
  'published',
  'archived',
  'withdrawn',
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const statusLabels: Record<ContentStatus, string> = {
  draft: 'Brouillon',
  changes_requested: 'Renvoyé pour correction',
  in_review: 'En relecture',
  in_validation: 'En validation',
  scheduled: 'Programmé',
  published: 'Publié',
  archived: 'Archivé',
  withdrawn: 'Retiré',
};

export const categoryRoles = ['redacteur', 'verificateur', 'validateur'] as const;
export type CategoryRole = (typeof categoryRoles)[number];

export const roleLabels: Record<CategoryRole, string> = {
  redacteur: 'Rédacteur',
  verificateur: 'Vérificateur',
  validateur: 'Validateur',
};

export const workflowActions = [
  'submit',
  'approve_review',
  'return',
  'validate',
  'publish_urgent',
  'withdraw',
  'archive',
  'restore',
  'reopen',
  'trash',
] as const;
export type WorkflowAction = (typeof workflowActions)[number];

export const actionLabels: Record<WorkflowAction, string> = {
  submit: 'Soumettre',
  approve_review: 'Transmettre pour validation',
  return: 'Renvoyer pour correction',
  validate: 'Valider',
  publish_urgent: 'Publier en urgence',
  withdraw: 'Retirer du site',
  archive: 'Archiver',
  restore: 'Remettre en ligne',
  reopen: 'Rouvrir en brouillon',
  trash: 'Mettre à la corbeille',
};

/** Actions qui exigent un commentaire (motif, justification). */
export const actionsRequiringComment: readonly WorkflowAction[] = ['return', 'publish_urgent', 'withdraw'];

/** État d'un contenu, tel que le moteur a besoin de le connaître. */
export interface WorkflowContent {
  status: ContentStatus;
  authorId: string;
  reviewerId: string | null;
  /** Étape de vérification requise (figée à la soumission pour les contenus en cours). */
  requiresReview: boolean;
  /** Circuit d'urgence autorisé dans la catégorie. */
  urgentAllowed: boolean;
  trashed: boolean;
}

/** Utilisateur qui agit, avec ses rôles dans la catégorie du contenu. */
export interface WorkflowActor {
  id: string;
  isAdmin: boolean;
  roles: readonly CategoryRole[];
}

const has = (actor: WorkflowActor, role: CategoryRole) => actor.roles.includes(role);

/**
 * Actions possibles pour cet utilisateur sur ce contenu.
 * Règle des « quatre yeux » : l'auteur ne vérifie ni ne valide son propre contenu,
 * et le vérificateur ne valide pas un contenu qu'il a lui-même vérifié.
 */
export function allowedActions(content: WorkflowContent, actor: WorkflowActor): WorkflowAction[] {
  const actions: WorkflowAction[] = [];
  const isAuthor = content.authorId === actor.id;
  const isReviewer = content.reviewerId === actor.id;
  const validator = has(actor, 'validateur');

  if (content.trashed) return actions;

  switch (content.status) {
    case 'draft':
    case 'changes_requested':
      if (isAuthor && has(actor, 'redacteur')) actions.push('submit', 'trash');
      else if (actor.isAdmin) actions.push('trash');
      break;
    case 'in_review':
      if (has(actor, 'verificateur') && !isAuthor) actions.push('approve_review', 'return');
      if (content.urgentAllowed && validator && !isAuthor) actions.push('publish_urgent');
      break;
    case 'in_validation':
      if (validator && !isAuthor && !isReviewer) actions.push('validate', 'return');
      break;
    case 'scheduled':
    case 'published':
      if (validator || actor.isAdmin) actions.push('withdraw');
      if (content.status === 'published' && (validator || actor.isAdmin)) actions.push('archive');
      break;
    case 'archived':
      if (validator) actions.push('restore');
      if (actor.isAdmin) actions.push('trash');
      break;
    case 'withdrawn':
      if ((isAuthor && has(actor, 'redacteur')) || validator) actions.push('reopen');
      if (actor.isAdmin) actions.push('trash');
      break;
  }
  return actions;
}

/** Qui peut modifier le texte du contenu à ce stade. */
export function canEdit(content: WorkflowContent, actor: WorkflowActor): boolean {
  if (content.trashed) return false;
  if (content.status === 'draft' || content.status === 'changes_requested') {
    return content.authorId === actor.id && has(actor, 'redacteur');
  }
  // Le vérificateur peut corriger la forme pendant la relecture.
  if (content.status === 'in_review') return has(actor, 'verificateur') && content.authorId !== actor.id;
  return false;
}

/** Statut atteint après une action. */
export function nextStatus(action: WorkflowAction, content: Pick<WorkflowContent, 'status' | 'requiresReview'>, publishAt: Date, now: Date): ContentStatus {
  const goLive: ContentStatus = publishAt.getTime() > now.getTime() ? 'scheduled' : 'published';
  switch (action) {
    case 'submit':
      return content.requiresReview ? 'in_review' : 'in_validation';
    case 'approve_review':
      return 'in_validation';
    case 'return':
      return 'changes_requested';
    case 'validate':
    case 'publish_urgent':
      return goLive;
    case 'withdraw':
      return 'withdrawn';
    case 'archive':
      return 'archived';
    case 'restore':
      return 'published';
    case 'reopen':
      return 'draft';
    case 'trash':
      return content.status;
  }
}

/** Étapes du circuit, pour l'affichage (frise). */
export function circuitSteps(requiresReview: boolean) {
  return [
    { id: 'redaction', label: 'Rédaction' },
    ...(requiresReview ? [{ id: 'verification', label: 'Vérification' }] : []),
    { id: 'validation', label: 'Validation' },
    { id: 'publication', label: 'Publication' },
  ] as const;
}
