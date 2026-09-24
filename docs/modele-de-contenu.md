# Modèle de contenu — référence pour le back-office

Le portail est alimenté par **11 collections**. Leur structure est définie **une seule fois**, en Zod, dans
`packages/shared/src/schemas.ts`. Cette définition sert trois fois :

- l'API (`apps/api`) valide chaque fichier avant de le servir ;
- le front-end (`apps/web`) en déduit ses types TypeScript ;
- le futur back-office validera ses formulaires avec les mêmes schémas.

Les **actualités** sont en base de données et se gèrent dans le back-office (`/admin`), avec leur circuit de
publication. Les autres collections sont encore des fichiers JSON dans `apps/api/data/`, relus à chaud : pas
besoin de redémarrer l'API. Elles passeront en base dans les prochaines phases.

## API (lecture)

| Méthode | Route | Réponse |
| --- | --- | --- |
| GET | `/api/v1/health` | `{ status, uptime }` |
| GET | `/api/v1/{collection}` | la collection entière (`site`, `hero`, `programmes`, `stats`, `news`, `services`, `dean`, `faculty`, `testimonials`, `gallery`, `explore`) |
| GET | `/api/v1/news?category=&limit=&offset=` | `{ categories, counts, items, total, limit, offset }`, trié par date décroissante (`limit` ≤ 100) |
| GET | `/api/v1/news/{id}` | `{ item, category }`, ou 404 (`id` = identifiant d'URL du contenu) |
| POST | `/api/v1/contact` | `{ name, email, phone?, subject, message }` → 201. Erreurs : 422 `{ error: { fields } }`, 413 si le corps est trop volumineux, 429 au-delà de 5 messages par IP en 15 min |

Les messages de contact sont enregistrés dans `apps/api/storage/messages.jsonl`, un message JSON par ligne
(`id`, `receivedAt`, puis les champs du formulaire). Le back-office les affichera. L'envoi par e-mail pourra
s'ajouter dans `JsonlMessageStore`. Le champ piège `website` n'est jamais enregistré : s'il est rempli, l'API
répond 201 sans rien stocker.

Toutes les erreurs ont la forme `{ "error": { "code", "message" } }`. Si une collection ne respecte pas son
schéma, l'API répond 500 `content_unavailable` et consigne le détail dans ses logs. Ce détail n'est jamais
renvoyé au client.

Règles communes :

- Tout le texte est affiché comme du texte brut (React échappe tout). Le back-office peut donc stocker du texte sans HTML.
- Les liens acceptés sont les chemins internes (`/actualites/...`), `http(s)://`, `mailto:` et `tel:`. Tout autre lien devient `#` (`safeUrl`).
- Les dates sont au format ISO `AAAA-MM-JJ`.
- Un texte en arabe est détecté automatiquement : il s'affiche de droite à gauche, avec une police arabe.
- Les champs `image` et `photo` sont optionnels. S'ils sont vides, un visuel graphique aux couleurs FSBM les remplace.

## API d'administration (`/api/admin`)

Toutes les routes exigent une session (cookie `fsbm_admin`), sauf la connexion. Les requêtes d'écriture doivent
porter l'en-tête `x-fsbm-csrf: 1` et venir de la même origine. Les réponses ne sont jamais mises en cache.

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/auth/login` · `/auth/logout` · `/auth/password` | Connexion, déconnexion, changement de mot de passe |
| GET | `/auth/me` | Utilisateur connecté et ses rôles par catégorie |
| GET | `/dashboard` | « En attente de mon action », mes brouillons, programmés, activité récente |
| GET / POST | `/contents` | Liste filtrée (`status` — dont `trash` pour la corbeille —, `category`, `q`, `mine=1`) · création d'un brouillon |
| GET / PATCH / DELETE | `/contents/{id}` | Lecture (avec les permissions de l'utilisateur) · modification (`{ version, data }`) · suppression définitive (admin, corbeille) |
| POST | `/contents/{id}/transitions` | `{ action, comment, version }` : `submit`, `approve_review`, `return`, `validate`, `publish_urgent`, `withdraw`, `archive`, `restore`, `reopen`, `trash` |
| POST | `/contents/{id}/revision` · `/contents/{id}/restore` | Révision d'un contenu publié · sortie de corbeille (admin) |
| POST | `/uploads` | Image (JPEG, PNG, WebP) ou PDF, servi ensuite sous `/uploads/…` |
| GET / POST / PATCH | `/categories`, `/categories/{id}` | Catégories et circuit (admin pour l'écriture) |
| POST / DELETE | `/categories/{id}/members`, `/categories/{id}/members/{userId}/{role}` | Affectation des rôles (admin) |
| GET / POST / PATCH | `/users`, `/users/{id}`, `/users/{id}/reset-password` | Comptes (admin) |
| GET | `/audit` | Journal d'audit (admin) |

Codes utiles : 401 non connecté, 403 action non permise, 409 conflit de version (`stale`) ou identifiant déjà pris,
422 validation (`{ error: { fields } }`), 429 trop de tentatives de connexion.

Seuls les contenus **publiés** dont la date de publication est passée, hors corbeille et hors révision en cours,
apparaissent dans `/api/v1/news`.

## `site` — identité et coordonnées

| Champ | Type | Exemple |
| --- | --- | --- |
| `name` | texte | Faculté des Sciences Ben M'Sik |
| `shortName` | texte | FSBM |
| `university` | texte | Université Hassan II de Casablanca |
| `tagline` | texte | Phrase de présentation (pied de page) |
| `contact.email` | email | fsbm.contact@univh2c.ma |
| `contact.phone` | téléphone international (lien `tel:`) | +212661442427 |
| `contact.phoneDisplay` | texte affiché | (+212) 6 61 44 24 27 |
| `contact.address` | liste de lignes | ["Faculté des Sciences Ben M'Sik", "Boulevard Driss El Harti, Ben M'Sik", "Casablanca, Maroc"] |
| `socials[]` | `{ network, label, url }` | `network` ∈ facebook, twitter, linkedin, youtube, instagram |

## `hero` — carrousel « À la une »

`image` : photo de fond du hero (affichée en monochrome bleu nuit). `slides[]` : `{ id, kicker, title, subtitle, url, cta }`. Ordre d'affichage = ordre de la liste.

## `programmes` — Nos programmes

`items[]` : `{ id, title, count (nombre ou null), description, url }`. Si `count` vaut `null`, le badge « N formations » est masqué.

## `stats` — Chiffres clés

`year` (ex. `"2024-2025"`) et `items[]` : `{ id, value (nombre), prefix, suffix, label, short, description, featured }`.
L'élément `featured: true` occupe la grande carte. Le hero affiche les trois premiers éléments, avec le libellé `short`.

## `news` — Actualités et annonces

Géré dans le back-office. La réponse publique garde la même forme qu'avant :

- `categories[]` : `{ id, label }`, issues des catégories du back-office. Seules celles qui contiennent au moins une actualité publiée apparaissent dans les filtres.
- `items[]` : `{ id, title, excerpt, body[] (paragraphes de la page détail), category, date, image, url, featured, attachments[] }`.
  - `featured: true` place l'actualité en « une » ; sinon, c'est la plus récente.
  - `attachments[]` : `{ label, url }` (PDF des listes, etc.), dans un volet repliable sur l'accueil et en grille sur la page détail `/actualites/{id}`.

## `services` — Services du campus

`items[]` : `{ id, icon, title, description, url, highlight }`, où `icon` ∈ portal, apply, chart, document, exam, graduate, info.
Ces services forment la bande « Accès rapide » sous le hero. `highlight: true` ajoute un filet doré en haut de la tuile.

## `dean` — Mot du Doyen

`{ name, title, photo, quote, message[] (paragraphes), url }`.

## `faculty` — Corps enseignant

`items[]` : `{ id, name, title, department, photo, url }`. Les photos s'affichent en noir et blanc et passent en couleur au survol.

## `testimonials` — Ils parlent de nous

`items[]` : `{ id, platform: "youtube", videoId (11 caractères), title, author, description }`.
Le lecteur YouTube (youtube-nocookie) ne se charge qu'au clic. Si `videoId` est vide, la carte indique « Vidéo bientôt disponible ».

## `gallery` — Vie à la FSBM

`items[]` : `{ id, image, alt, kicker, caption }`. Les trois premières photos forment la grille de la section :
toutes les photos forment la mosaïque pleine largeur affichée avant le pied de page. `alt` décrit la photo pour les lecteurs d'écran ; ce champ est obligatoire.

## `explore` — La FSBM de l'intérieur

`tabs[]` : `{ id, label, more?: { label, url }, items[] }`, avec `items[]` : `{ id, title, description, image, visual, url }`.
Chaque onglet (Départements, Recherche, Vie étudiante…) affiche ses cartes. La carte « Voir tout » (`more`) vient
en dernier. Une carte sans `image` affiche le motif `visual` (rings, grid, helix, strata, dots, orbit).
La colonne **Avis officiels** n'a pas de collection propre : elle reprend les 3 dernières actualités qui ont des pièces jointes.
