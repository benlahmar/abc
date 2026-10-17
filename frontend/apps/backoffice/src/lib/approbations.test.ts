import { describe, expect, it } from 'vitest';
import { afterApproval } from './approbations';

const steps = [
  { order: 1, name: 'Vice-doyen', role: 'VICE_DOYEN_PEDAGOGIE', status: 'PENDING' as const },
  { order: 2, name: 'Doyen', role: 'DOYEN', status: 'CONDITIONAL' as const },
];

describe('approbation', () => {
  it('signe directement si aucune étape ne suit', () => {
    expect(afterApproval(steps, false)).toMatchObject({ signs: true, canEscalate: true, next: [] });
  });
  it('passe au doyen si une validation supplémentaire est demandée', () => {
    const r = afterApproval(steps, true);
    expect(r.signs).toBe(false);
    expect(r.next.map((s) => s.role)).toEqual(['DOYEN']);
  });
  it('enchaîne les étapes obligatoires', () => {
    const r = afterApproval([steps[0], { ...steps[1], status: 'WAITING' }], false);
    expect(r).toMatchObject({ signs: false, canEscalate: false });
  });
});
