import { describe, expect, it } from 'vitest';
import { parseNote, parsePastedGrades, toGradeLines, weightedAverage } from './grades';

describe('notes collées depuis Excel', () => {
  it('lit les colonnes séparées par des tabulations, avec en-tête et virgule décimale', () => {
    const rows = parsePastedGrades('Code\tModule\tNote\tCrédits\nM51\tRéseaux\t14,5\t6\nM52\tBases de données\t9,25\t6\n\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: 'M51', intitule: 'Réseaux', note: '14,5', credits: '6' });
    expect(weightedAverage(rows)).toBe(11.88);
  });

  it('accepte le point-virgule et signale les notes illisibles', () => {
    const rows = parsePastedGrades('M51;Réseaux;ABI;6');
    expect(parseNote(rows[0].note)).toBeNull();
    expect(Number.isNaN(toGradeLines(rows)[0].note)).toBe(true);
  });

  it('ignore les lignes vides et pondère par les crédits', () => {
    expect(weightedAverage([
      { code: 'A', intitule: 'a', note: '10', credits: '2', resultat: '' },
      { code: 'B', intitule: 'b', note: '16', credits: '', resultat: '' },
    ])).toBe(12);
    expect(toGradeLines([{ code: '', intitule: '', note: '', credits: '', resultat: '' }])).toEqual([]);
  });
});
