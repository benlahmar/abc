import { z } from 'zod';

/**
 * Modèle de contenu du portail. Ces schémas sont la source de vérité :
 * l'API valide les données avec, le front-end en déduit ses types,
 * et le futur back-office validera ses formulaires avec.
 */

const text = z.string().trim();
const optionalText = text.optional().default('');
/** Lien interne (/…), ancre, http(s), mailto: ou tel:. Le filtrage final est fait par safeUrl(). */
const link = text.default('#');
/** Date ISO AAAA-MM-JJ. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

export const SocialNetwork = z.enum(['facebook', 'twitter', 'linkedin', 'youtube', 'instagram']);

export const SiteSchema = z.object({
  name: text,
  shortName: text,
  university: text,
  tagline: optionalText,
  logo: optionalText,
  contact: z.object({
    email: z.email(),
    phone: text,
    phoneDisplay: text,
    address: z.array(text).min(1),
  }),
  socials: z.array(z.object({ network: SocialNetwork, label: text, url: link })).default([]),
});

export const HeroSchema = z.object({
  /** Photo de fond du hero (chemin /images/… ou URL). */
  image: optionalText,
  slides: z
    .array(
      z.object({
        id: text,
        kicker: optionalText,
        title: text,
        subtitle: optionalText,
        url: link,
        cta: text.default('Voir plus'),
      }),
    )
    .default([]),
});

export const ProgrammesSchema = z.object({
  items: z.array(
    z.object({
      id: text,
      title: text,
      count: z.number().int().nonnegative().nullable().default(null),
      description: text,
      url: link,
    }),
  ),
});

export const StatsSchema = z.object({
  year: optionalText,
  items: z.array(
    z.object({
      id: text,
      value: z.number(),
      prefix: optionalText,
      suffix: optionalText,
      label: text,
      short: optionalText,
      description: optionalText,
      featured: z.boolean().default(false),
    }),
  ),
});

export const AttachmentSchema = z.object({ label: text, url: link });

export const NewsItemSchema = z.object({
  id: text,
  title: text,
  excerpt: optionalText,
  body: z.array(text).default([]),
  category: text,
  date: isoDate,
  image: optionalText,
  url: link,
  featured: z.boolean().default(false),
  attachments: z.array(AttachmentSchema).default([]),
});

export const NewsSchema = z.object({
  categories: z.array(z.object({ id: text, label: text })),
  items: z.array(NewsItemSchema),
});

export const ServiceIcon = z.enum(['portal', 'apply', 'chart', 'document', 'exam', 'graduate', 'info']);

export const ServicesSchema = z.object({
  items: z.array(
    z.object({
      id: text,
      icon: ServiceIcon.default('info'),
      title: text,
      description: optionalText,
      url: link,
      highlight: z.boolean().default(false),
    }),
  ),
});

export const DeanSchema = z.object({
  name: text,
  title: text,
  photo: optionalText,
  quote: optionalText,
  message: z.array(text).default([]),
  url: link,
});

export const FacultySchema = z.object({
  items: z.array(
    z.object({
      id: text,
      name: text,
      title: optionalText,
      department: optionalText,
      photo: optionalText,
      url: link,
    }),
  ),
});

export const TestimonialsSchema = z.object({
  items: z.array(
    z.object({
      id: text,
      platform: z.literal('youtube').default('youtube'),
      /** Identifiant YouTube (11 caractères) ; vide tant que la vidéo n'est pas renseignée. */
      videoId: z.union([z.string().regex(/^[\w-]{11}$/), z.literal('')]).default(''),
      title: text,
      author: optionalText,
      description: optionalText,
    }),
  ),
});

export const GallerySchema = z.object({
  items: z.array(
    z.object({
      id: text,
      image: text,
      /** Texte alternatif décrivant la photo (accessibilité). */
      alt: text,
      kicker: optionalText,
      caption: optionalText,
    }),
  ),
});

/** « La FSBM de l'intérieur » : onglets de cartes (départements, recherche, vie étudiante…). */
export const ExploreSchema = z.object({
  tabs: z
    .array(
      z.object({
        id: text,
        label: text,
        /** Lien « Voir tout » affiché en dernière carte. */
        more: z.object({ label: text, url: link }).optional(),
        items: z.array(
          z.object({
            id: text,
            title: text,
            description: optionalText,
            image: optionalText,
            /** Motif de remplacement si pas de photo : rings, grid, helix, strata, dots, orbit. */
            visual: z.enum(['rings', 'grid', 'helix', 'strata', 'dots', 'orbit']).optional(),
            url: link,
          }),
        ),
      }),
    )
    .min(1),
});

/** Sujets proposés dans le formulaire de contact. */
export const contactSubjects = ['scolarite', 'formation', 'recherche', 'partenariat', 'autre'] as const;
export const contactSubjectLabels: Record<(typeof contactSubjects)[number], string> = {
  scolarite: 'Scolarité et inscriptions',
  formation: 'Offre de formation',
  recherche: 'Recherche et laboratoires',
  partenariat: 'Partenariats et entreprises',
  autre: 'Autre demande',
};

/** Message envoyé depuis le formulaire de contact (POST /api/v1/contact). */
export const ContactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  email: z.email('Adresse e-mail invalide').max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, 'Numéro de téléphone invalide')
    .optional()
    .default(''),
  subject: z.enum(contactSubjects, { message: 'Choisissez l’objet de votre message' }),
  message: z.string().trim().min(10, 'Votre message est trop court (10 caractères minimum)').max(5000),
  /** Champ piège invisible : rempli uniquement par les robots. */
  website: z.string().max(0).optional().default(''),
});

export const collections = {
  site: SiteSchema,
  hero: HeroSchema,
  programmes: ProgrammesSchema,
  stats: StatsSchema,
  news: NewsSchema,
  services: ServicesSchema,
  dean: DeanSchema,
  faculty: FacultySchema,
  testimonials: TestimonialsSchema,
  gallery: GallerySchema,
  explore: ExploreSchema,
} as const;

export type CollectionName = keyof typeof collections;
export const collectionNames = Object.keys(collections) as CollectionName[];
export const isCollectionName = (value: string): value is CollectionName => Object.hasOwn(collections, value);

export type Site = z.infer<typeof SiteSchema>;
export type Hero = z.infer<typeof HeroSchema>;
export type HeroSlide = Hero['slides'][number];
export type Programmes = z.infer<typeof ProgrammesSchema>;
export type Programme = Programmes['items'][number];
export type Stats = z.infer<typeof StatsSchema>;
export type Stat = Stats['items'][number];
export type News = z.infer<typeof NewsSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type NewsCategory = News['categories'][number];
export type Attachment = z.infer<typeof AttachmentSchema>;
export type Services = z.infer<typeof ServicesSchema>;
export type Service = Services['items'][number];
export type Dean = z.infer<typeof DeanSchema>;
export type Faculty = z.infer<typeof FacultySchema>;
export type FacultyMember = Faculty['items'][number];
export type Testimonials = z.infer<typeof TestimonialsSchema>;
export type Testimonial = Testimonials['items'][number];

export type Gallery = z.infer<typeof GallerySchema>;
export type GalleryItem = Gallery['items'][number];
export type Explore = z.infer<typeof ExploreSchema>;
export type ExploreTab = Explore['tabs'][number];
export type ContactMessage = z.input<typeof ContactMessageSchema>;
export type ContactSubject = (typeof contactSubjects)[number];

export interface CollectionMap {
  site: Site;
  hero: Hero;
  programmes: Programmes;
  stats: Stats;
  news: News;
  services: Services;
  dean: Dean;
  faculty: Faculty;
  testimonials: Testimonials;
  gallery: Gallery;
  explore: Explore;
}

/** Réponse paginée de GET /api/v1/news. */
export interface NewsPage {
  categories: NewsCategory[];
  /** Nombre d'actualités par catégorie (toutes catégories confondues : clé « all »). */
  counts: Record<string, number>;
  items: NewsItem[];
  total: number;
  limit: number;
  offset: number;
}

/** Réponse de GET /api/v1/news/:id. */
export interface NewsDetail {
  item: NewsItem;
  category: NewsCategory | null;
}
