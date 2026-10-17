import type { ApprovalStatus, ApprovalStep } from '@esign/api';
import type { Tone } from '@esign/ui';

export const ETAPE_STATUTS: Record<ApprovalStatus, [string, Tone | 'neutre']> = {
  PENDING: ['En attente de décision', 'attente'],
  WAITING: ['À venir', 'neutre'],
  CONDITIONAL: ['Si validation supplémentaire', 'neutre'],
  APPROVED: ['Approuvé', 'ok'],
  REJECTED: ['Refusé', 'ko'],
  SKIPPED: ['Non applicable', 'neutre'],
};

/** Motifs proposés au validateur ; le motif est consigné au journal et visible du service de scolarité. */
export const MOTIFS_REFUS = [
  'Notes non conformes au procès-verbal de délibération',
  'Usage déclaré non justifié',
  'État civil de l\'étudiant à vérifier',
  'Document en double : un exemplaire est déjà délivré',
];

/**
 * Ce que déclenche l'approbation de l'étape en cours : la signature immédiate, ou d'autres étapes.
 * Les étapes conditionnelles ne s'appliquent que si une validation supplémentaire est demandée.
 */
export function afterApproval(steps: ApprovalStep[] = [], escalate: boolean) {
  const current = steps.find((s) => s.status === 'PENDING');
  const suivantes = steps.filter((s) => (s.order ?? 0) > (current?.order ?? 0));
  const appliquees = suivantes.filter((s) => s.status === 'WAITING' || (s.status === 'CONDITIONAL' && escalate));
  return {
    current,
    /** Étapes restantes après cette décision. */
    next: appliquees,
    /** Vrai : approuver signe le document. */
    signs: appliquees.length === 0,
    /** Une validation supplémentaire peut être demandée (une étape conditionnelle suit). */
    canEscalate: suivantes.some((s) => s.status === 'CONDITIONAL'),
  };
}
