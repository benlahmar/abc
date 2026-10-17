import { describe, expect, it } from 'vitest';
import { checkSteps, describeChange, emptyStep, nameForRole, normalize, sameSteps, simulate } from './parametrage';
import type { WorkflowStep } from '@esign/api';

const circuit: WorkflowStep[] = [
  { name: 'Vice-doyen', role: 'VICE_DOYEN_PEDAGOGIE', condition: 'IF_PURPOSE', purposes: ['ETRANGER'] },
  { name: 'Doyen', role: 'DOYEN', condition: 'IF_ESCALATED' },
];

describe('paramétrage du circuit', () => {
  it('simule le passage d\'un document', () => {
    expect(simulate(circuit, '', false)).toEqual([]);
    expect(simulate(circuit, 'ETRANGER', false).map((s) => s.role)).toEqual(['VICE_DOYEN_PEDAGOGIE']);
    expect(simulate(circuit, 'STAGE', true).map((s) => s.role)).toEqual(['DOYEN']);
  });

  it('signale les étapes incomplètes', () => {
    expect(checkSteps(circuit)).toEqual({});
    expect(checkSteps([{ name: ' ', role: 'vice doyen', condition: 'IF_PURPOSE', purposes: [] }])).toEqual({
      'steps[0].name': 'Donnez un nom à l\'étape', 'steps[0].role': 'Rôle Keycloak : majuscules, chiffres et _', 'steps[0].purposes': 'Cochez au moins un usage',
    });
  });

  it('ignore les usages d\'une étape qui ne dépend pas de l\'usage', () => {
    expect(normalize([{ name: ' Doyen ', role: 'DOYEN', condition: 'ALWAYS', purposes: ['ETRANGER'] }])).toEqual([{ name: 'Doyen', role: 'DOYEN', condition: 'ALWAYS' }]);
    expect(sameSteps(circuit, [...circuit])).toBe(true);
    expect(sameSteps(circuit, circuit.slice(1))).toBe(false);
  });

  it('rend lisible l\'historique', () => {
    expect(describeChange('WORKFLOW_UPDATED', 'RELEVE_NOTES : VICE_DOYEN_PEDAGOGIE[IF_PURPOSE:ETRANGER|BOURSE] -> DOYEN[IF_ESCALATED]', { ETRANGER: 'Dossier pour l\'étranger', BOURSE: 'Bourse' }))
      .toBe('Relevé de notes : Vice-doyen à la pédagogie si dossier pour l\'étranger ou bourse, puis Doyen sur demande');
    expect(describeChange('WORKFLOW_UPDATED', 'ATTESTATION_SCOLARITE : aucune étape (signature immédiate)')).toBe('Attestation de scolarité : signature immédiate, sans validation');
    expect(describeChange('STUDENT_ACCESS_UPDATED', 'RELEVE_NOTES : AGENT, 3 demande(s)/jour')).toBe('Relevé de notes : demande en ligne « traitée par le service », 3 par jour et par étudiant');
  });

  it('propose un nom qui suit le rôle tant qu\'il n\'est pas personnalisé', () => {
    const s = emptyStep();
    expect(nameForRole(s, 'DOYEN')).toBe('Validation du doyen');
    expect(nameForRole({ ...s, name: 'Avis pédagogique' }, 'DOYEN')).toBe('Avis pédagogique');
    expect(nameForRole(s, 'SECRETAIRE_GENERAL')).toBe('');
  });
});
