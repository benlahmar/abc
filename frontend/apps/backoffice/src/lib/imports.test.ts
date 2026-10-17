import { describe, expect, it } from 'vitest';
import { checkImportFile, duration, formatLines, progress, withoutLinePrefix } from './imports';

describe('imports Apogée', () => {
  it('accepte les exports CSV et Excel, refuse le reste', () => {
    expect(checkImportFile({ name: 'S5-SMI.XLSX', size: 10 })).toBeUndefined();
    expect(checkImportFile({ name: 'export.csv', size: 10 })).toBeUndefined();
    expect(checkImportFile({ name: 'notes.pdf', size: 10 })).toMatch(/CSV ou Excel/);
    expect(checkImportFile({ name: 'vide.csv', size: 0 })).toMatch(/vide/);
    expect(checkImportFile({ name: 'gros.csv', size: 21 * 1024 * 1024 })).toMatch(/20 Mo/);
  });

  it('calcule l\'avancement', () => {
    expect(progress({ total: 8, succeeded: 5, failed: 1 })).toEqual({ total: 8, done: 5, failed: 1, remaining: 2, donePct: 62.5, failedPct: 12.5 });
    expect(progress({ total: 0 }).donePct).toBe(0);
  });

  it('formate les numéros de ligne', () => {
    expect(formatLines('6')).toBe('ligne 6');
    expect(formatLines('2-5')).toBe('lignes 2 à 5');
    expect(formatLines('2,4,9')).toBe('lignes 2, 4, 9');
    expect(withoutLinePrefix('lignes 2-5 : note invalide')).toBe('note invalide');
    expect(withoutLinePrefix('ligne 7 : CNE manquant')).toBe('CNE manquant');
  });

  it('affiche une durée', () => {
    expect(duration('2026-01-01T10:00:00Z', '2026-01-01T10:02:05Z')).toBe('2 min 05 s');
    expect(duration('2026-01-01T10:00:00Z', '2026-01-01T10:00:09Z')).toBe('9 s');
  });
});
