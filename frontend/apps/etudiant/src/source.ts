import type { Api, MyDocument, MyRequest, NewStudentRequest, StudentProfile } from '@esign/api';

/** Données de l'étudiant : l'API, ou des données d'exemple en mode démonstration. */
export interface Source {
  demo: boolean;
  profil: () => Promise<StudentProfile>;
  documents: () => Promise<MyDocument[]>;
  demandes: () => Promise<MyRequest[]>;
  envoyer: (demande: NewStudentRequest) => Promise<MyRequest>;
  /** PDF signé, ou null en démonstration. */
  telecharger: (doc: MyDocument) => Promise<Blob | null>;
}

export const sourceApi = (api: Api): Source => ({
  demo: false,
  profil: api.me,
  documents: api.myDocuments,
  demandes: api.myRequests,
  envoyer: api.createMyRequest,
  telecharger: (doc) => api.downloadMyDocument(doc.id!),
});

const ilYa = (jours: number, heures = 0) => new Date(Date.now() - (jours * 24 + heures) * 3600e3).toISOString();

/** Démonstration sans serveur ni compte : rien n'est envoyé. */
export function sourceDemo(): Source {
  const documents: MyDocument[] = [
    { id: 'd1', type: 'RELEVE_NOTES', label: 'Relevé de notes', status: 'SIGNED', academicYear: '2025-2026', semester: 'S5',
      createdAt: ilYa(2), signedAt: ilYa(2), verificationCode: 'PYZVH-Z3830-X9B28-CQ19P',
      verificationUrl: 'https://esign.fsbm.ma/verify/PYZVH-Z3830-X9B28-CQ19P', downloadUrl: '#' },
    { id: 'd2', type: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', status: 'SIGNED', academicYear: '2025-2026',
      createdAt: ilYa(21), signedAt: ilYa(21), verificationCode: 'KFFH8-SSNTP-3GYNG-XC28A',
      verificationUrl: 'https://esign.fsbm.ma/verify/KFFH8-SSNTP-3GYNG-XC28A', downloadUrl: '#' },
    { id: 'd3', type: 'RELEVE_NOTES', label: 'Relevé de notes', status: 'REVOKED', academicYear: '2024-2025', semester: 'S4',
      createdAt: ilYa(160), signedAt: ilYa(160), verificationCode: 'M2Q7D-8TRWA-4KXNB-J61PZ', revokedAt: ilYa(150),
      revocationReason: 'note du module M42 corrigée après réclamation, un nouveau relevé a été établi' },
    { id: 'd4', type: 'RELEVE_NOTES', label: 'Relevé de notes', status: 'SIGNED', academicYear: '2024-2025', semester: 'S4',
      createdAt: ilYa(149), signedAt: ilYa(149), verificationCode: 'C7HN2-QW4ZE-9MBXT-5RD8K',
      verificationUrl: 'https://esign.fsbm.ma/verify/C7HN2-QW4ZE-9MBXT-5RD8K', downloadUrl: '#' },
  ];
  const demandes: MyRequest[] = [
    { id: 'r1', type: 'RELEVE_NOTES', label: 'Relevé de notes', academicYear: '2025-2026', semester: 'S6', status: 'PENDING', createdAt: ilYa(0, 3) },
    { id: 'r2', type: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', academicYear: '2026-2027', status: 'REJECTED',
      message: 'Votre réinscription 2026-2027 n\'est pas encore finalisée : réglez les frais puis renouvelez la demande.',
      createdAt: ilYa(1), handledAt: ilYa(0, 20) },
  ];
  return {
    demo: true,
    profil: async () => ({ cne: 'R130456789', username: 'etudiant', name: 'Yasmine El Amrani', documentTypes: [
      { type: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', mode: 'REGISTRY', dailyLimit: 3, immediate: true },
      { type: 'RELEVE_NOTES', label: 'Relevé de notes', mode: 'AGENT', dailyLimit: 3, immediate: false },
    ] }),
    documents: async () => [...documents],
    demandes: async () => [...demandes],
    envoyer: async (d) => {
      const r: MyRequest = { id: `demo-${Date.now()}`, type: d.type, academicYear: d.academicYear, semester: d.semester, status: 'PENDING', createdAt: new Date().toISOString() };
      demandes.unshift(r);
      return r;
    },
    telecharger: async () => null,
  };
}
