import type { GradeLine } from '@esign/api';

/** Ligne de note en cours de saisie (valeurs texte, telles que tapées). */
export interface GradeDraft {
  code: string;
  intitule: string;
  note: string;
  credits: string;
  resultat: string;
}

export const emptyGrade = (): GradeDraft => ({ code: '', intitule: '', note: '', credits: '', resultat: '' });

/** « 14,5 » ou « 14.5 » → 14.5 ; null si illisible. */
export function parseNote(raw: string): number | null {
  const v = raw.trim().replace(',', '.').replace(/\s/g, '');
  if (v === '' || !/^\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

/**
 * Lignes copiées depuis Excel (colonnes séparées par des tabulations, ou « ; ») :
 * code, module, note, crédits, résultat. Une ligne d'en-tête éventuelle est ignorée.
 */
export function parsePastedGrades(text: string): GradeDraft[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  const rows = lines.map((l) => l.split(l.includes('\t') ? '\t' : ';').map((c) => c.trim()));
  return rows
    .filter((cells, i) => !(i === 0 && cells.length >= 3 && parseNote(cells[2]) === null && /note/i.test(cells.join(' '))))
    .map((cells) => ({
      code: cells[0] ?? '',
      intitule: cells[1] ?? '',
      note: cells[2] ?? '',
      credits: cells[3] ?? '',
      resultat: cells[4] ?? '',
    }));
}

/** Le collage contient-il un tableau (plusieurs cellules ou plusieurs lignes) ? */
export const looksLikeTable = (text: string) => /\t|\n.+/.test(text.trim());

export function toGradeLines(drafts: GradeDraft[]): GradeLine[] {
  return drafts
    .filter((g) => g.code || g.intitule || g.note)
    .map((g) => ({
      code: g.code.trim(),
      intitule: g.intitule.trim(),
      note: parseNote(g.note) ?? Number.NaN,
      credits: g.credits.trim() ? Number(g.credits) : undefined,
      resultat: g.resultat.trim() || undefined,
    }));
}

/** Moyenne pondérée par les crédits (comme sur le relevé), ou null. */
export function weightedAverage(drafts: GradeDraft[]): number | null {
  let total = 0;
  let weights = 0;
  for (const g of drafts) {
    const note = parseNote(g.note);
    if (note === null) continue;
    const w = g.credits.trim() ? Number(g.credits) : 1;
    if (!Number.isFinite(w) || w <= 0) continue;
    total += note * w;
    weights += w;
  }
  return weights ? Math.round((total / weights) * 100) / 100 : null;
}
