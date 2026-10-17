import { describe, expect, it } from 'vitest';
import { annees, resumeFiliere, totaux } from './registre';

describe('registre des inscrits', () => {
  it('propose l\'année en cours et les précédentes', () => {
    expect(annees('2026-2027')).toEqual(['2026-2027', '2025-2026', '2024-2025', '2023-2024']);
  });
  it('résume les changements d\'une filière', () => {
    expect(resumeFiliere({ filiere: 'SMI', before: 120, after: 118, addedCount: 3, removedCount: 5, changedCount: 1 }))
      .toBe('120 → 118 : 3 arrivées, 5 départs, 1 changement');
    expect(resumeFiliere({ filiere: 'SMP', before: 0, after: 40, addedCount: 40, removedCount: 0, changedCount: 0 }))
      .toBe('40 inscrits, nouvelle liste : 40 arrivées');
    expect(resumeFiliere({ filiere: 'SMA', before: 2, after: 2, addedCount: 0, removedCount: 0, changedCount: 0 }))
      .toBe('2 → 2 : aucun changement');
  });
  it('totalise un rapport', () => {
    expect(totaux({ problems: [{ line: 3 }], filieres: [{ addedCount: 2, removedCount: 1 }, { removedCount: 4, changedCount: 1 }] }))
      .toEqual({ filieres: 2, arrivees: 2, departs: 5, changements: 1, erreurs: 1 });
  });
});
