import { describe, expect, it } from 'vitest';
import { acteur, empreinteCourte, libelle, typesDe } from './audit';

describe('journal d\'audit', () => {
  it('traduit les types d\'événements', () => {
    expect(libelle('DOCUMENT_REVOKED')).toBe('Révoqué');
    expect(libelle('NOUVEAU_TYPE')).toBe('NOUVEAU_TYPE');
    expect(typesDe('Registre des inscrits')).toEqual(['REGISTRY_IMPORTED', 'REGISTRY_BLOCKED', 'REGISTRY_UNBLOCKED', 'REGISTRY_PURGED']);
  });
  it('abrège une empreinte', () => {
    expect(empreinteCourte('3f2a9c' + '0'.repeat(52) + 'b41e07')).toBe('3f2a9c…b41e07');
  });
  it('sépare l\'acteur et la manière', () => {
    expect(acteur('agent.apogee (authentifié via esign-backoffice)')).toEqual({ qui: 'agent.apogee', comment: 'authentifié via esign-backoffice' });
    expect(acteur('cachet-electronique')).toEqual({ qui: 'cachet-electronique' });
  });
});
