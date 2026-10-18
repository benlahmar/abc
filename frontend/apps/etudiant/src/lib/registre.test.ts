import { describe, expect, it } from 'vitest';
import type { MyDocument, MyRequest } from '@esign/api';
import { anneeCourante, correspond, delai, demandesDuJour, doublon, entrees } from './registre';

const docs: MyDocument[] = [
  { id: 'd1', type: 'RELEVE_NOTES', status: 'SIGNED', academicYear: '2025-2026', semester: 'S5', signedAt: '2026-01-10T10:00:00Z', verificationCode: 'PYZVH-Z3830' },
  { id: 'd2', type: 'ATTESTATION_SCOLARITE', status: 'REJECTED', academicYear: '2025-2026' },
  { id: 'd3', type: 'RELEVE_NOTES', status: 'REVOKED', academicYear: '2024-2025', semester: 'S4', signedAt: '2025-03-01T10:00:00Z' },
];
const dems: MyRequest[] = [
  { id: 'r1', type: 'RELEVE_NOTES', status: 'PENDING', academicYear: '2025-2026', semester: 'S6', createdAt: '2026-02-01T09:00:00Z' },
  { id: 'r2', type: 'ATTESTATION_SCOLARITE', status: 'FULFILLED', academicYear: '2025-2026', createdAt: '2026-02-01T09:00:00Z' },
];

describe('registre de l\'étudiant', () => {
  it('réunit documents et demandes, par année puis du plus récent', () => {
    expect(entrees(docs, dems).map((e) => e.cle)).toEqual(['dem:r1', 'doc:d1', 'doc:d3']);
  });
  it('filtre et recherche par mots', () => {
    const [r1, d1, d3] = entrees(docs, dems);
    expect(correspond(d1, 'prets', '')).toBe(true);
    expect(correspond(r1, 'prets', '')).toBe(false);
    expect(correspond(d3, 'clos', 'relevé 2024 s4')).toBe(true);
    expect(correspond(d1, 'tout', 'pyzvh')).toBe(true);
    expect(correspond(d1, 'tout', 'attestation')).toBe(false);
  });
  it('compte les demandes du jour', () => {
    expect(demandesDuJour(dems, 'RELEVE_NOTES', new Date('2026-02-01T15:00:00Z'))).toBe(1);
    expect(demandesDuJour(dems, 'RELEVE_NOTES', new Date('2026-02-02T15:00:00Z'))).toBe(0);
  });
  it('annonce le délai réel', () => {
    const oct = new Date('2026-10-18');
    expect(anneeCourante(oct)).toBe('2026-2027');
    expect(delai({ mode: 'REGISTRY', immediate: true }, '2026-2027', oct)).toBe('inscription');
    expect(delai({ mode: 'REGISTRY', immediate: true }, '2025-2026', oct)).toBe('service');
    expect(delai({ mode: 'AUTO' }, '2025-2026', oct)).toBe('apogee');
    expect(delai({ mode: 'AGENT', immediate: false }, '2026-2027', oct)).toBe('service');
  });
  it('repère un document ou une demande identique', () => {
    expect(doublon(docs, dems, { type: 'RELEVE_NOTES', annee: '2025-2026', semestre: 'S5' })?.cle).toBe('doc:d1');
    expect(doublon(docs, dems, { type: 'RELEVE_NOTES', annee: '2025-2026', semestre: 'S6' })?.cle).toBe('dem:r1');
    expect(doublon(docs, dems, { type: 'ATTESTATION_SCOLARITE', annee: '2025-2026' })).toBeUndefined();
  });
});
