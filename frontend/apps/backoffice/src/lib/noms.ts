const capitaliser = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());

/**
 * Nom et prénom à partir du nom complet de la demande. Deux formes : « EL AMRANI Yasmine » (nom en
 * capitales, usage administratif) ou « Yasmine El Amrani » (nom affiché par le SSO : prénom, puis nom).
 */
export function decouperNom(complet?: string): { nom: string; prenom: string } {
  const mots = (complet ?? '').trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { nom: mots[0] ?? '', prenom: '' };
  const capitales = mots.filter((m) => m === m.toUpperCase() && /\p{L}/u.test(m));
  if (capitales.length && capitales.length < mots.length) {
    return { nom: capitaliser(capitales.join(' ')), prenom: mots.filter((m) => !capitales.includes(m)).join(' ') };
  }
  return { prenom: mots[0], nom: mots.slice(1).join(' ') };
}
