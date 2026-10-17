import type { RegistryFiliereDiff, RegistryReport } from '@esign/api';

/** Années proposées : l'année en cours et les trois précédentes (les plus anciennes sont purgées). */
export function annees(current: string): string[] {
  const start = Number(current.slice(0, 4));
  return [0, 1, 2, 3].map((i) => `${start - i}-${start - i + 1}`);
}

const n = (x?: number) => x ?? 0;

/** Résumé d'une filière, ex. « 120 → 118 : 3 arrivées, 5 départs, 4 changements ». */
export function resumeFiliere(d: RegistryFiliereDiff): string {
  const parts = [
    n(d.addedCount) && `${d.addedCount} arrivée${n(d.addedCount) > 1 ? 's' : ''}`,
    n(d.removedCount) && `${d.removedCount} départ${n(d.removedCount) > 1 ? 's' : ''}`,
    n(d.changedCount) && `${d.changedCount} changement${n(d.changedCount) > 1 ? 's' : ''}`,
  ].filter(Boolean);
  const effectifs = n(d.before) ? `${d.before} → ${d.after}` : `${d.after} inscrit${n(d.after) > 1 ? 's' : ''}, nouvelle liste`;
  return parts.length ? `${effectifs} : ${parts.join(', ')}` : `${effectifs} : aucun changement`;
}

/** Totaux d'un rapport, pour la confirmation. */
export function totaux(r: RegistryReport) {
  const f = r.filieres ?? [];
  return {
    filieres: f.length,
    arrivees: f.reduce((s, d) => s + n(d.addedCount), 0),
    departs: f.reduce((s, d) => s + n(d.removedCount), 0),
    changements: f.reduce((s, d) => s + n(d.changedCount), 0),
    erreurs: (r.problems ?? []).length,
  };
}
