/**
 * Structure de navigation du portail. Elle pourra être déplacée dans l'API (collection « navigation »)
 * lorsque le back-office devra la rendre modifiable.
 */
export interface NavLink {
  label: string;
  href: string;
}

export interface MegaMenu {
  intro: { eyebrow: string; title: string; text: string; link?: NavLink };
  columns: Array<{ title: string; links: NavLink[] }>;
  feature: { eyebrow: string; title: string; link: NavLink };
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  mega?: MegaMenu;
}

export const primaryNav: NavItem[] = [
  {
    id: 'accueil',
    label: 'Accueil',
    href: '/',
    mega: {
      intro: {
        eyebrow: 'La Faculté',
        title: 'Un pôle de savoir au service de la société.',
        text: 'Établissement de l’Université Hassan II de Casablanca, ouvert et inclusif, qui forme chaque année des milliers d’étudiants marocains et internationaux.',
      },
      columns: [
        {
          title: 'Découvrir',
          links: [
            { label: 'Mot du Doyen', href: '/accueil/mot-du-doyen' },
            { label: 'Organigramme', href: '/accueil/organigramme' },
            { label: 'Chiffres Clés', href: '/accueil/chiffres-cles' },
            { label: 'Enseignants / Professeurs', href: '/enseignants' },
          ],
        },
      ],
      feature: {
        eyebrow: 'Mot du Doyen',
        title: '« Ensemble, construisons une FSBM plus forte, plus innovante et plus ouverte sur l’avenir. »',
        link: { label: 'Lire le message', href: '/accueil/mot-du-doyen' },
      },
    },
  },
  { id: 'actualites', label: 'Actualités', href: '/actualites' },
  {
    id: 'formation',
    label: 'Formation',
    href: '/formation',
    mega: {
      intro: {
        eyebrow: 'Formation',
        title: 'De la Licence au Doctorat.',
        text: 'Une offre complète adaptée à tous les niveaux et à tous les profils, en formation initiale comme continue.',
        link: { label: 'Toute l’offre de formation', href: '/formation' },
      },
      columns: [
        {
          title: 'Formation initiale',
          links: [
            { label: 'Licences', href: '/formation/licences' },
            { label: 'Masters', href: '/formation/masters' },
            { label: 'Doctorats', href: '/formation/doctorats' },
          ],
        },
        {
          title: 'Parcours spécifiques',
          links: [
            { label: 'Formation d’Excellence', href: '/formation/excellence' },
            { label: 'Formation Continue', href: '/formation/formation-continue' },
            { label: 'Programmes Courts', href: '/formation/programmes-courts' },
          ],
        },
      ],
      feature: {
        eyebrow: 'Pré-candidature',
        title: 'Déposez votre candidature en ligne aux formations de la FSBM.',
        link: { label: 'Accéder à la plateforme', href: '/pre-candidature' },
      },
    },
  },
  { id: 'departements', label: 'Départements', href: '/departements' },
  { id: 'recherche', label: 'Recherche', href: '/recherche' },
  { id: 'services', label: 'Services', href: '/services' },
  { id: 'etudiant', label: 'Étudiant', href: '/etudiant' },
  { id: 'partenariat', label: 'Partenariat', href: '/partenariat' },
];

export const footerNav = {
  quick: [
    { label: 'Accueil', href: '/' },
    { label: 'Formation', href: '/formation' },
    { label: 'Recherche', href: '/recherche' },
    { label: 'Partenariat', href: '/partenariat' },
    { label: 'Étudiant', href: '/etudiant' },
    { label: 'Départements', href: '/departements' },
  ],
  resources: [
    { label: 'Portail Étudiant', href: '/portail-etudiant' },
    { label: 'Portail Professeur', href: '/portail-professeur' },
    { label: 'Bibliothèque', href: '/bibliotheque' },
    { label: 'Événements', href: '/evenements' },
    { label: 'Pré-Candidature', href: '/pre-candidature' },
    { label: 'Publications', href: '/publications' },
  ],
  legal: [
    { label: 'Accessibilité', href: '/accessibilite' },
    { label: 'Mentions légales', href: '/mentions-legales' },
    { label: 'Confidentialité', href: '/confidentialite' },
  ],
} satisfies Record<string, NavLink[]>;
