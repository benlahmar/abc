import type { Batch, BatchItemStatus, BatchStatus } from '@esign/api';
import type { Tone } from '@esign/ui';

/** Taille maximale acceptée par l'API (spring.servlet.multipart.max-file-size). */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.csv', '.txt', '.xlsx', '.xls'];

/** Contrôle avant envoi : message à afficher, ou undefined si le fichier peut être vérifié. */
export function checkImportFile(file: { name: string; size: number }): string | undefined {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((e) => name.endsWith(e))) {
    return `« ${file.name} » n'est pas un export pris en charge : utilisez un fichier CSV ou Excel (.xlsx, .xls).`;
  }
  if (file.size === 0) return `« ${file.name} » est vide.`;
  if (file.size > MAX_FILE_SIZE) return `« ${file.name} » dépasse 20 Mo : découpez l'export par filière ou par semestre.`;
  return undefined;
}

export const LOT_STATUTS: Record<BatchStatus, [string, Tone]> = {
  QUEUED: ['En file d\'attente', 'attente'],
  RUNNING: ['Signature en cours', 'attente'],
  COMPLETED: ['Terminé', 'ok'],
  COMPLETED_WITH_ERRORS: ['Terminé avec erreurs', 'ko'],
};

export const ELEMENT_STATUTS: Record<BatchItemStatus, [string, Tone]> = {
  SIGNED: ['Signé', 'ok'],
  AWAITING_APPROVAL: ['En validation', 'attente'],
  PENDING: ['À traiter', 'attente'],
  FAILED: ['En erreur', 'ko'],
};

export const enCours = (b?: Batch) => b?.status === 'QUEUED' || b?.status === 'RUNNING';

/** Avancement d'un traitement : documents établis, en erreur, restants, en pourcentage du total. */
export function progress(b: Batch) {
  const total = b.total ?? 0;
  const done = b.succeeded ?? 0;
  const failed = b.failed ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return { total, done, failed, remaining: Math.max(0, total - done - failed), donePct: pct(done), failedPct: pct(failed) };
}

/** « 6 » → « ligne 6 » ; « 2-5 » → « lignes 2 à 5 » ; « 2,4,9 » → « lignes 2, 4, 9 ». */
export function formatLines(lines?: string): string {
  if (!lines) return '';
  if (/^\d+$/.test(lines)) return `ligne ${lines}`;
  const range = /^(\d+)-(\d+)$/.exec(lines);
  if (range) return `lignes ${range[1]} à ${range[2]}`;
  return `lignes ${lines.split(',').join(', ')}`;
}

/** Retire le préfixe « lignes 2-5 : » des erreurs, déjà affiché à côté. */
export const withoutLinePrefix = (error: string) => error.replace(/^lignes? [\d,-]+ : /, '');

export const pluriel = (n: number, un: string, plusieurs = `${un}s`) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;

/** Durée lisible entre deux instants, ex. « 2 min 05 s ». */
export function duration(from?: string, to?: string): string {
  if (!from || !to) return '';
  const s = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
