/** Catalogue des événements du journal : libellé en clair et rubrique. Un type inconnu s'affiche tel quel. */
export const RUBRIQUES = ['Documents', 'Circuit de validation', 'Demandes étudiantes', 'Traitements en masse', 'Registre des inscrits', 'Paramétrage'] as const;
export type Rubrique = typeof RUBRIQUES[number];

export const EVENEMENTS: Record<string, { label: string; rubrique: Rubrique; ton?: 'ok' | 'ko' | 'attente' }> = {
  DOCUMENT_ISSUED: { label: 'Établi', rubrique: 'Documents' },
  DOCUMENT_SIGNED: { label: 'Signé (cachet électronique)', rubrique: 'Documents', ton: 'ok' },
  DOCUMENT_REVOKED: { label: 'Révoqué', rubrique: 'Documents', ton: 'ko' },
  STEP_APPROVED: { label: 'Étape approuvée', rubrique: 'Circuit de validation', ton: 'ok' },
  STEP_REJECTED: { label: 'Étape refusée', rubrique: 'Circuit de validation', ton: 'ko' },
  STUDENT_REQUEST: { label: 'Demandé par l\'étudiant', rubrique: 'Demandes étudiantes' },
  STUDENT_REQUEST_FULFILLED: { label: 'Demande traitée', rubrique: 'Demandes étudiantes', ton: 'ok' },
  STUDENT_REQUEST_REJECTED: { label: 'Demande refusée', rubrique: 'Demandes étudiantes', ton: 'ko' },
  BATCH_SUBMITTED: { label: 'Traitement en masse lancé', rubrique: 'Traitements en masse' },
  REGISTRY_IMPORTED: { label: 'Liste d\'inscrits importée', rubrique: 'Registre des inscrits' },
  REGISTRY_BLOCKED: { label: 'Étudiant bloqué', rubrique: 'Registre des inscrits', ton: 'ko' },
  REGISTRY_UNBLOCKED: { label: 'Étudiant débloqué', rubrique: 'Registre des inscrits' },
  REGISTRY_PURGED: { label: 'Listes d\'une année supprimées', rubrique: 'Registre des inscrits', ton: 'attente' },
  WORKFLOW_UPDATED: { label: 'Circuit de validation modifié', rubrique: 'Paramétrage', ton: 'attente' },
  STUDENT_ACCESS_UPDATED: { label: 'Demande en ligne modifiée', rubrique: 'Paramétrage', ton: 'attente' },
};

export const libelle = (type?: string) => (type && EVENEMENTS[type]?.label) || type || '';

/** Types connus d'une rubrique, pour le filtre. */
export const typesDe = (r: Rubrique) => Object.keys(EVENEMENTS).filter((t) => EVENEMENTS[t].rubrique === r);

/** Empreinte abrégée lisible : « 3f2a9c…b41e07 ». */
export const empreinteCourte = (h?: string) => (h && h.length > 16 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h ?? '');

/** Acteur en clair : « agent.apogee (authentifié via esign-backoffice) » → { qui, comment }. */
export function acteur(raw = ''): { qui: string; comment?: string } {
  const m = /^(.+?) \((.+)\)$/.exec(raw);
  return m ? { qui: m[1], comment: m[2] } : { qui: raw };
}
