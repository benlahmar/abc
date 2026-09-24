# Portail FSBM

Portail web de la **Faculté des Sciences Ben M'Sik** (Université Hassan II de Casablanca).

| | |
| --- | --- |
| **Front-end** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, TanStack Query, React Router 7 |
| **Back-end** | Node.js (≥ 20.19), Express 5, Zod, Helmet |
| **Partagé** | Schémas Zod du contenu et types TypeScript, communs à l'API, au front et au futur back-office |

## Démarrer

```bash
npm install
npm run dev        # API sur :4000 + front sur http://localhost:5173 (proxy /api vers l'API)
```

Autres commandes :

```bash
npm test           # tests (schémas partagés + API)
npm run typecheck  # vérification TypeScript de tous les paquets
npm run build      # compile le front (apps/web/dist) puis l'API (apps/api/dist)
npm start          # production : l'API sert aussi le front compilé, sur :4000
```

## Architecture

```
apps/
  api/                  API Node.js / Express
    data/*.json         contenu (11 collections), relu à chaud
    storage/            messages du formulaire de contact (non versionné)
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
packages/
  shared/               schémas Zod + types + safeUrl()
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

## Prochaine étape : le back-office

Le back-office viendra se brancher sur la même API. Il faudra ajouter :

1. l'authentification des responsables et leurs rôles (par exemple : actualités, formations, contenu institutionnel) ;
2. les routes d'écriture `POST` / `PUT` / `DELETE` sur `/api/v1/...`, validées par les schémas de `@fsbm/shared` ;
3. le téléversement des images et des PDF ;
4. une implémentation de `ContentRepository` sur une base de données (PostgreSQL par exemple) à la place des fichiers JSON.
