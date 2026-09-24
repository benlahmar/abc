# Modèle de contenu — référence pour le back-office

Le portail est alimenté par **10 collections**. Leur structure est définie **une seule fois**, en Zod, dans
`packages/shared/src/schemas.ts`. Cette définition sert trois fois :

- l'API (`apps/api`) valide chaque fichier avant de le servir ;
- le front-end (`apps/web`) en déduit ses types TypeScript ;
- le futur back-office validera ses formulaires avec les mêmes schémas.

Aujourd'hui, les données sont des fichiers JSON dans `apps/api/data/`. Ils sont relus à chaud dès qu'ils
changent : pas besoin de redémarrer l'API.

## API (lecture)

| Méthode | Route | Réponse |
| --- | --- | --- |
| GET | `/api/v1/health` | `{ status, uptime }` |
| GET | `/api/v1/{collection}` | la collection entière (`site`, `hero`, `programmes`, `stats`, `news`, `services`, `dean`, `faculty`, `testimonials`, `gallery`) |
| GET | `/api/v1/news?category=&limit=&offset=` | `{ categories, counts, items, total, limit, offset }`, trié par date décroissante (`limit` ≤ 100) |
| GET | `/api/v1/news/{id}` | `{ item, category }`, ou 404 |
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

- `categories[]` : `{ id, label }`. Seules les catégories qui contiennent au moins une actualité apparaissent dans les filtres.
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
une grande photo à gauche, deux à droite. `alt` décrit la photo pour les lecteurs d'écran ; ce champ est obligatoire.
