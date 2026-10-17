import { DOCUMENT_LABELS, type DocumentType, type StudentAccessMode, type WorkflowCondition, type WorkflowStep } from '@esign/api';

/** Rôles de validation définis dans Keycloak (realm « universite »). Un autre rôle peut être saisi. */
export const ROLES: Record<string, string> = {
  VICE_DOYEN_PEDAGOGIE: 'Vice-doyen à la pédagogie',
  DOYEN: 'Doyen',
};

export const roleLabel = (role: string) => ROLES[role] ?? role;

/** Nom proposé pour une étape décidée par ce rôle. */
export const DEFAULT_NAMES: Record<string, string> = {
  VICE_DOYEN_PEDAGOGIE: 'Validation du vice-doyen à la pédagogie',
  DOYEN: 'Validation du doyen',
};

export const CONDITIONS: Record<WorkflowCondition, { label: string; aide: string }> = {
  ALWAYS: { label: 'Toujours', aide: 'Chaque document passe par cette étape.' },
  IF_PURPOSE: { label: 'Selon l\'usage', aide: 'Seulement pour les usages cochés (ex. dossier pour l\'étranger).' },
  IF_ESCALATED: { label: 'Sur demande', aide: 'Seulement si l\'agent ou un validateur précédent demande une validation supplémentaire.' },
};

export const MODES: Record<StudentAccessMode, { label: string; aide: string }> = {
  DISABLED: { label: 'Fermée', aide: 'Pas de demande en ligne. L\'étudiant voit et télécharge toujours ses documents.' },
  AGENT: { label: 'Traitée par le service', aide: 'La demande arrive dans la file « Demandes étudiantes » ; un agent l\'établit.' },
  AUTO: { label: 'Immédiate depuis Apogée', aide: 'Le document est produit et signé aussitôt à partir de la vue Oracle Apogée.' },
};

export const STEP_ROLE = /^[A-Z][A-Z0-9_]{1,59}$/;

export const emptyStep = (): WorkflowStep => ({ name: DEFAULT_NAMES.VICE_DOYEN_PEDAGOGIE, role: 'VICE_DOYEN_PEDAGOGIE', condition: 'ALWAYS' });

/** Le nom suit le rôle choisi tant que l'administrateur ne l'a pas personnalisé. */
export const nameForRole = (step: WorkflowStep, role: string) =>
  !step.name.trim() || step.name === DEFAULT_NAMES[step.role] ? DEFAULT_NAMES[role] ?? '' : step.name;

/** Contrôles identiques à ceux de l'API, pour signaler les erreurs à côté de chaque étape. */
export function checkSteps(steps: WorkflowStep[]): Record<string, string> {
  const e: Record<string, string> = {};
  steps.forEach((s, i) => {
    if (!s.name.trim()) e[`steps[${i}].name`] = 'Donnez un nom à l\'étape';
    else if (s.name.trim().length > 100) e[`steps[${i}].name`] = '100 caractères au plus';
    if (!STEP_ROLE.test(s.role)) e[`steps[${i}].role`] = 'Rôle Keycloak : majuscules, chiffres et _';
    if (s.condition === 'IF_PURPOSE' && !s.purposes?.length) e[`steps[${i}].purposes`] = 'Cochez au moins un usage';
  });
  if (steps.length > 10) e.steps = '10 étapes au plus';
  return e;
}

/** Étapes nettoyées avant envoi (usages seulement pour la condition « selon l'usage »). */
export const normalize = (steps: WorkflowStep[]): WorkflowStep[] =>
  steps.map((s) => ({ name: s.name.trim(), role: s.role, condition: s.condition, ...(s.condition === 'IF_PURPOSE' ? { purposes: s.purposes ?? [] } : {}) }));

export const sameSteps = (a: WorkflowStep[], b: WorkflowStep[]) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

/** Étapes par lesquelles passerait un document (même règle que l'API à la création). */
export function simulate(steps: WorkflowStep[], purpose: string, escalated: boolean): WorkflowStep[] {
  return steps.filter((s) => s.condition === 'ALWAYS'
    || (s.condition === 'IF_PURPOSE' && !!purpose && (s.purposes ?? []).includes(purpose))
    || (s.condition === 'IF_ESCALATED' && escalated));
}

/** Rend lisible le détail d'une modification enregistrée dans le journal d'audit. */
export function describeChange(eventType: string, details = '', usages: Record<string, string> = {}): string {
  const [type, rest = ''] = details.split(' : ');
  const doc = DOCUMENT_LABELS[type as DocumentType] ?? type;
  if (eventType === 'STUDENT_ACCESS_UPDATED') {
    const m = /^(\w+), (\d+)/.exec(rest);
    if (!m) return `${doc} : ${rest}`;
    const mode = MODES[m[1] as StudentAccessMode]?.label ?? m[1];
    return `${doc} : demande en ligne « ${mode.toLowerCase()} », ${m[2]} par jour et par étudiant`;
  }
  if (rest.startsWith('aucune étape')) return `${doc} : signature immédiate, sans validation`;
  const steps = rest.split(' -> ').map((part) => {
    const m = /^(\w+)\[(\w+)(?::([\w|]+))?\]$/.exec(part);
    if (!m) return part;
    const quand = m[2] === 'IF_PURPOSE' ? ` si ${m[3]!.split('|').map((u) => (usages[u] ?? u).toLowerCase()).join(' ou ')}`
      : m[2] === 'IF_ESCALATED' ? ' sur demande' : '';
    return `${roleLabel(m[1])}${quand}`;
  });
  return `${doc} : ${steps.join(', puis ')}`;
}
