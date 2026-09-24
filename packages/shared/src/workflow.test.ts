import { describe, expect, it } from 'vitest';
import { allowedActions, canEdit, nextStatus, type WorkflowActor, type WorkflowContent } from './workflow.js';

const content = (over: Partial<WorkflowContent> = {}): WorkflowContent => ({
  status: 'draft',
  authorId: 'auteur',
  reviewerId: null,
  requiresReview: true,
  urgentAllowed: false,
  trashed: false,
  ...over,
});
const actor = (id: string, roles: WorkflowActor['roles'] = [], isAdmin = false): WorkflowActor => ({ id, roles, isAdmin });

const auteur = actor('auteur', ['redacteur']);
const verif = actor('verif', ['verificateur']);
const valid = actor('valid', ['validateur']);

describe('circuit de publication', () => {
  it('le rédacteur soumet son brouillon, qui part en relecture ou directement en validation', () => {
    expect(allowedActions(content(), auteur)).toContain('submit');
    expect(nextStatus('submit', content(), new Date(), new Date())).toBe('in_review');
    expect(nextStatus('submit', content({ requiresReview: false }), new Date(), new Date())).toBe('in_validation');
  });

  it('un autre rédacteur ne peut pas soumettre le brouillon de quelqu’un d’autre', () => {
    expect(allowedActions(content(), actor('autre', ['redacteur']))).toEqual([]);
  });

  it('le vérificateur transmet ou renvoie, mais jamais son propre contenu', () => {
    expect(allowedActions(content({ status: 'in_review' }), verif)).toEqual(['approve_review', 'return']);
    const auteurVerif = actor('auteur', ['redacteur', 'verificateur']);
    expect(allowedActions(content({ status: 'in_review' }), auteurVerif)).toEqual([]);
  });

  it('le validateur valide, sauf s’il est l’auteur ou le vérificateur', () => {
    const c = content({ status: 'in_validation', reviewerId: 'verif' });
    expect(allowedActions(c, valid)).toEqual(['validate', 'return']);
    expect(allowedActions(c, actor('verif', ['verificateur', 'validateur']))).toEqual([]);
    expect(allowedActions(content({ status: 'in_validation', authorId: 'valid' }), valid)).toEqual([]);
  });

  it('la validation programme ou publie selon la date', () => {
    const now = new Date('2026-09-24T10:00:00Z');
    expect(nextStatus('validate', content(), new Date('2026-09-25T08:00:00Z'), now)).toBe('scheduled');
    expect(nextStatus('validate', content(), new Date('2026-09-24T09:00:00Z'), now)).toBe('published');
  });

  it('la publication en urgence n’existe que si la catégorie l’autorise', () => {
    expect(allowedActions(content({ status: 'in_review' }), valid)).not.toContain('publish_urgent');
    expect(allowedActions(content({ status: 'in_review', urgentAllowed: true }), valid)).toContain('publish_urgent');
  });

  it('seuls validateurs et administrateurs retirent ou archivent un contenu publié', () => {
    expect(allowedActions(content({ status: 'published' }), auteur)).toEqual([]);
    expect(allowedActions(content({ status: 'published' }), valid)).toEqual(['withdraw', 'archive']);
    expect(allowedActions(content({ status: 'published' }), actor('admin', [], true))).toEqual(['withdraw', 'archive']);
  });

  it('un contenu à la corbeille n’accepte aucune action', () => {
    expect(allowedActions(content({ trashed: true }), auteur)).toEqual([]);
  });

  it('droits de modification : l’auteur en brouillon, le vérificateur en relecture', () => {
    expect(canEdit(content(), auteur)).toBe(true);
    expect(canEdit(content({ status: 'in_review' }), auteur)).toBe(false);
    expect(canEdit(content({ status: 'in_review' }), verif)).toBe(true);
    expect(canEdit(content({ status: 'published' }), valid)).toBe(false);
  });
});
