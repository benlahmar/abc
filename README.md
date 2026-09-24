# Portail FSBM

Portail web de la **Faculté des Sciences Ben M'Sik** (Université Hassan II de Casablanca).

| | |
| --- | --- |
| **Front-end** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, TanStack Query, React Router 7 |
| **Back-office** | React 19, Vite 8, Tailwind CSS v4, TanStack Query (servi sous `/admin`) |
| **Back-end** | Node.js (≥ 20.19), Express 5, Zod, Helmet, Drizzle ORM, PostgreSQL (PGlite en développement), argon2id |
| **Partagé** | Schémas Zod, moteur du circuit de publication et types TypeScript, communs à l'API, au site et au back-office |

## Démarrer

```bash
npm install
npm run dev        # API :4000 + site http://localhost:5173 + back-office http://localhost:5174/admin/
npm run seed:demo  # (facultatif) comptes et catégories de démonstration
```

Sans `DATABASE_URL`, l'API utilise une base PGlite locale (`apps/api/.data/pglite`, non versionnée) : aucune
installation de PostgreSQL n'est nécessaire en développement. Au premier démarrage, les migrations s'appliquent,
les catégories Recherche, Scolarité et Institutionnelle sont créées et les actualités de `data/news.json` sont
importées en base.

### Comptes de démonstration (`npm run seed:demo`, refusé en production)

Mot de passe commun : `Demo-FSBM-2026`.

| Compte | Rôles |
| --- | --- |
| `admin@fsbm.test` | Administrateur |
| `redaction.recherche@fsbm.test` | Rédacteur — Recherche, Institutionnelle |
| `communication@fsbm.test` | Vérificateur — Recherche, Institutionnelle |
| `vicedoyen.recherche@fsbm.test` | Validateur — Recherche |
| `scolarite@fsbm.test` | Rédacteur — Scolarité |
| `chef.scolarite@fsbm.test` | Validateur — Scolarité (publication d'urgence autorisée) |
| `doyen@fsbm.test` | Validateur — Institutionnelle |

Ces comptes ne doivent **jamais** exister sur un serveur de production.

Autres commandes :

```bash
npm test           # tests (schémas partagés + API)
npm run typecheck  # vérification TypeScript de tous les paquets
npm run build      # compile le site, le back-office puis l'API
npm start          # production : l'API sert le site et le back-office (/admin), sur :4000
```

### Production

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (`postgres://…`). Obligatoire en production. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Premier administrateur, créé au démarrage si aucun n'existe. Il devra changer son mot de passe à la première connexion. |
| `SECURE_COOKIES` | `true` par défaut en production (HTTPS requis). |
| `SESSION_TTL_HOURS` | Durée d'une session (12 h par défaut). |
| `STORAGE_DIR` | Fichiers téléversés et messages de contact (`apps/api/storage` par défaut). |
| `PGLITE_DIR` | Emplacement de la base PGlite locale (développement). |
| `WEB_DIST`, `ADMIN_DIST` | Dossiers compilés du site et du back-office. |

## Architecture

```
apps/
  api/                  API Node.js / Express
    data/*.json         contenu éditorial (collections), relu à chaud
    migrations/         schéma SQL (utilisateurs, catégories, contenus, commentaires, journal)
    storage/            messages de contact et fichiers téléversés (non versionné)
    src/admin/          API du back-office : auth, utilisateurs, catégories, contenus, téléversements, journal
    src/db/             Drizzle + migrateur (PostgreSQL ou PGlite)
    src/scheduler.ts    publication programmée et archivage automatique (toutes les 30 s)
    src/news.ts         actualités publiques, lues en base
    src/repository.ts   accès aux données (fichiers JSON aujourd'hui, base de données demain)
    src/routes/         GET /api/v1/{collection}, /news (filtre + pagination), /news/:id, POST /contact
    src/app.ts          sécurité (Helmet/CSP), CORS, compression, cache HTTP, service du front
  web/                  Front-end React
    src/components/
      layout/           en-tête, méga-menus, menu mobile, pied de page
      home/             sections de l'accueil
      news/             cartes d'actualités, pièces jointes
      ui/               boutons, révélations animées, compteurs, constellation, visuels
    public/images/      logo FSBM (couleur et blanc), photo du doyen, photos du campus
    src/pages/          accueil, détail d'actualité, contact, page « en préparation »
    src/lib/            client API, hooks React Query, formats, navigation
  admin/                Back-office React (tableau de bord, contenus, catégories, utilisateurs, journal)
packages/
  shared/               schémas Zod + moteur du circuit (workflow.ts) + types + safeUrl()
docs/
  modele-de-contenu.md  référence des collections et de l'API (base du back-office)
```

## Design

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `brand` | `#2A5494` | Bleu du logo FSBM : couleur principale (accents, boutons, bandeaux) |
| `brand-light` | `#9DB8E6` | Accents bleus sur fond sombre (contraste AA) |
| `steel` | `#888888` | Gris du logo FSBM |
| `midnight` / `midnight-950` | `#0B1D3A` / `#06112A` | Surfaces sombres, teintées du bleu FSBM |
| `paper` / `ivory` | `#F8FAFC` / `#F3F1EC` | Fonds clairs |
| `muted` | `#5F6B7A` | Texte secondaire |
| `gold` | `#C5A059` | Accent discret uniquement : filets, points, barres de progression |

Polices (auto-hébergées) : Cormorant Garamond (titres), Inter (interface et chiffres), IBM Plex Sans Arabic (contenus en arabe).

Le hero utilise une vraie photo de la Faculté, passée en monochrome bleu nuit, sous la constellation animée.
Là où une photo manque encore (actualités, enseignants), un **visuel génératif** la remplace. Il suffit de
renseigner `image` ou `photo` dans les données pour afficher la vraie photo. Les images sont en WebP optimisé
(logo, doyen, campus : moins de 120 Ko chacune).

## Qualité

- **Accessibilité** : lien d'évitement, méga-menus au modèle « disclosure » WAI-ARIA (clavier : Échap, ↓, ←/→), menu mobile sur `<dialog>` natif, carrousel avec bouton pause (WCAG 2.2.2), compteurs lus directement à leur valeur finale, `lang="ar" dir="rtl"` sur les textes arabes, animations désactivées si `prefers-reduced-motion`.
- **Sécurité** : CSP stricte, échappement systématique, liens filtrés par `safeUrl`, validation Zod des données et des paramètres, erreurs sans fuite d'information, API en lecture seule.
- **Performance** : polices auto-hébergées, découpage du bundle (react / motion / app), cache HTTP (`max-age=60, stale-while-revalidate`), fichiers fingerprintés en cache long, lecteur YouTube chargé seulement au clic, animation du hero suspendue hors écran.

## Back-office et circuit de publication

Chaque contenu appartient à une **catégorie**. L'administrateur crée les catégories et y affecte des
**rédacteurs**, **vérificateurs** et **validateurs**. Une catégorie peut se passer de vérification (Scolarité) et
autoriser la publication d'urgence.

```
Brouillon → En relecture → En validation → Programmé → Publié → Archivé
     ↑            │               │                       │
     └── Renvoyé pour correction ─┘                       └→ Retiré
```

- **Quatre yeux** : l'auteur ne vérifie ni ne valide son propre contenu ; le vérificateur ne valide pas ce qu'il a vérifié.
- Renvoyer, retirer et publier en urgence exigent un **commentaire**.
- Une fois validé, le contenu est publié **à la date et l'heure saisies** (heure de Casablanca), ou tout de suite si elle est passée. L'archivage automatique suit la date d'expiration, ou la durée de vie de la catégorie.
- Modifier un contenu publié crée une **révision** : l'original reste en ligne jusqu'à la validation de la révision.
- Corbeille : suppression logique ; seul l'administrateur restaure ou supprime définitivement.
- Verrouillage optimiste : deux personnes qui modifient le même contenu ne s'écrasent pas (409).
- Sécurité : mots de passe argon2id, cookie de session `HttpOnly` / `SameSite=Strict` (seule l'empreinte du jeton est stockée), protection CSRF, compte verrouillé 15 min après 5 échecs, limitation par IP, changement obligatoire des mots de passe temporaires, journal d'audit, fichiers téléversés contrôlés par leur signature.

Les règles sont écrites une seule fois dans `packages/shared/src/workflow.ts`. L'API les applique et le
back-office s'en sert pour n'afficher que les actions permises.

## Prochaines étapes

1. Notifications par e-mail à chaque étape (configuration SMTP à fournir).
2. Autres types de contenu dans le même circuit : pages, événements, galerie, formations.
3. Messages de contact consultables dans le back-office.
4. Double authentification et suppléants (absence d'un validateur).
