import { describe, expect, it } from 'vitest';
import { decouperNom } from './noms';

describe('nom et prénom', () => {
  it('reconnaît le nom en capitales', () => {
    expect(decouperNom('EL AMRANI Yasmine')).toEqual({ nom: 'El Amrani', prenom: 'Yasmine' });
    expect(decouperNom('Yasmine EL AMRANI')).toEqual({ nom: 'El Amrani', prenom: 'Yasmine' });
  });
  it('prend le premier mot comme prénom sinon (nom affiché par le SSO)', () => {
    expect(decouperNom('Yasmine El Amrani')).toEqual({ prenom: 'Yasmine', nom: 'El Amrani' });
  });
  it('ne devine pas au-delà', () => {
    expect(decouperNom('Yasmine')).toEqual({ nom: 'Yasmine', prenom: '' });
    expect(decouperNom(undefined)).toEqual({ nom: '', prenom: '' });
  });
});
