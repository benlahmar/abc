import type { DocumentType, MyDocument, MyRequest, StudentOffer } from '@esign/api';

export const TYPES: Record<DocumentType, { titre: string; aide: string }> = {
  ATTESTATION_SCOLARITE: { titre: 'Attestation de scolarité', aide: 'Prouve votre inscription pour une année universitaire.' },
  RELEVE_NOTES: { titre: 'Relevé de notes', aide: 'Les notes validées d\'un semestre.' },
};

export const USAGES: Record<string, string> = {
  '': 'Usage non précisé',
  ETRANGER: 'Dossier pour l\'étranger',
  INSCRIPTION: 'Inscription dans un autre établissement',
  STAGE: 'Stage ou emploi',
  BOURSE: 'Bourse',
};

export type Groupe = 'prets' | 'cours' | 'clos';
export type Filtre = Groupe | 'tout';
export type Statut = NonNullable<MyDocument['status']> | NonNullable<MyRequest['status']>;

export const ETATS: Record<Statut, { texte: string; classe: 'pret' | 'cours' | 'clos'; groupe: Groupe }> = {
  SIGNED: { texte: 'Prêt', classe: 'pret', groupe: 'prets' },
  PENDING_APPROVAL: { texte: 'En validation', classe: 'cours', groupe: 'cours' },
  PENDING: { texte: 'Demandé', classe: 'cours', groupe: 'cours' },
  REVOKED: { texte: 'Annulé par la faculté', classe: 'clos', groupe: 'clos' },
  REJECTED: { texte: 'Refusé', classe: 'clos', groupe: 'clos' },
  FAILED: { texte: 'Non abouti', classe: 'clos', groupe: 'clos' },
  FULFILLED: { texte: 'Prêt', classe: 'pret', groupe: 'prets' },
};

/** Une ligne du registre : un document délivré, ou une demande pas encore transformée en document. */
export type Entree =
  | { cle: string; nature: 'document'; type: DocumentType; annee: string; semestre?: string; statut: Statut; date?: string; ref?: string; doc: MyDocument }
  | { cle: string; nature: 'demande'; type: DocumentType; annee: string; semestre?: string; statut: Statut; date?: string; ref?: undefined; demande: MyRequest };

/** Documents (hors refusés en validation) et demandes en cours ou refusées, par année puis du plus récent. */
export function entrees(documents: MyDocument[], demandes: MyRequest[]): Entree[] {
  const docs: Entree[] = documents.filter((d) => d.status !== 'REJECTED').map((d) => ({
    cle: `doc:${d.id}`, nature: 'document', type: d.type!, annee: d.academicYear!, semestre: d.semester,
    statut: d.status!, date: d.signedAt ?? d.createdAt, ref: d.verificationCode, doc: d,
  }));
  const dems: Entree[] = demandes.filter((r) => r.status !== 'FULFILLED').map((r) => ({
    cle: `dem:${r.id}`, nature: 'demande', type: r.type!, annee: r.academicYear!, semestre: r.semester,
    statut: r.status!, date: r.createdAt, demande: r,
  }));
  return [...docs, ...dems].sort((a, b) => b.annee.localeCompare(a.annee) || (b.date ?? '').localeCompare(a.date ?? ''));
}

/** Filtre par groupe et recherche par mots (type, année, semestre, état, référence). */
export function correspond(e: Entree, filtre: Filtre, recherche: string): boolean {
  if (filtre !== 'tout' && ETATS[e.statut].groupe !== filtre) return false;
  const q = recherche.trim().toLowerCase();
  if (!q) return true;
  const texte = [TYPES[e.type].titre, e.annee, e.semestre, ETATS[e.statut].texte, e.ref].join(' ').toLowerCase();
  return q.split(/\s+/).every((mot) => texte.includes(mot));
}

export function anneeCourante(d = new Date()) {
  const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${a}-${a + 1}`;
}

export const anneesProposees = (d = new Date()) => {
  const a = Number(anneeCourante(d).slice(0, 4));
  return [0, 1, 2, 3, 4].map((i) => `${a - i}-${a - i + 1}`);
};

export function demandesDuJour(demandes: MyRequest[], type: DocumentType, aujourdhui = new Date()) {
  const jour = aujourdhui.toDateString();
  return demandes.filter((d) => d.type === type && d.createdAt && new Date(d.createdAt).toDateString() === jour).length;
}

/** Délai annoncé avant l'envoi : immédiat (vue Apogée, ou inscription au registre de l'année en cours) ou service. */
export function delai(offre: StudentOffer, annee: string, aujourdhui = new Date()): 'apogee' | 'inscription' | 'service' {
  const immediat = (offre.immediate ?? offre.mode === 'AUTO') && (offre.mode !== 'REGISTRY' || annee === anneeCourante(aujourdhui));
  if (!immediat) return 'service';
  return offre.mode === 'REGISTRY' ? 'inscription' : 'apogee';
}

/** Document identique déjà signé, ou demande identique en cours : à proposer plutôt qu'un doublon. */
export function doublon(documents: MyDocument[], demandes: MyRequest[], v: { type: DocumentType; annee: string; semestre?: string | null }) {
  const meme = (t?: string, a?: string, s?: string | null) => t === v.type && a === v.annee && (v.type !== 'RELEVE_NOTES' || s === v.semestre);
  const existant = documents.find((d) => meme(d.type, d.academicYear, d.semester) && d.status === 'SIGNED');
  if (existant) return { nature: 'document' as const, cle: `doc:${existant.id}`, date: existant.signedAt };
  const enCours = demandes.find((d) => meme(d.type, d.academicYear, d.semester) && d.status === 'PENDING');
  if (enCours) return { nature: 'demande' as const, cle: `dem:${enCours.id}`, date: enCours.createdAt };
  return undefined;
}
