# Modèle de contenu — base du futur back-office

Toute la page d'accueil est alimentée par **9 collections JSON**. Aujourd'hui, ce sont des fichiers
statiques dans `public/data/`. Le back-office devra exposer les mêmes structures en lecture :

```
GET {VITE_CONTENT_API_URL}/site
GET {VITE_CONTENT_API_URL}/hero
GET {VITE_CONTENT_API_URL}/programmes
GET {VITE_CONTENT_API_URL}/stats
GET {VITE_CONTENT_API_URL}/news
GET {VITE_CONTENT_API_URL}/services
GET {VITE_CONTENT_API_URL}/dean
GET {VITE_CONTENT_API_URL}/faculty
GET {VITE_CONTENT_API_URL}/testimonials
```

Le front-end n'a rien d'autre à changer : il suffit de définir `VITE_CONTENT_API_URL` dans `.env`
(voir `.env.example`) et de reconstruire le site.

Règles communes :

- Tout le texte est affiché **échappé** (aucun HTML interprété). Le back-office peut donc stocker du texte brut.
- Les liens acceptés sont les chemins relatifs (`/actualites/...`), `http(s)://`, `mailto:` et `tel:`. Tout autre lien est remplacé par `#`.
- Les dates sont au format ISO `AAAA-MM-JJ`.
- Un texte en arabe est détecté automatiquement : il s'affiche de droite à gauche, avec une police arabe.
- Les champs `image` et `photo` sont optionnels. S'ils sont vides, une illustration graphique aux couleurs FSBM les remplace.

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

`slides[]` : `{ id, kicker, title, subtitle, url, cta }`. Ordre d'affichage = ordre de la liste.

## `programmes` — Nos programmes

`items[]` : `{ id, title, count (nombre ou null), description, url }`. Si `count` vaut `null`, le badge « N formations » est masqué.

## `stats` — Chiffres clés

`year` (ex. `"2024-2025"`) et `items[]` : `{ id, value (nombre), prefix, suffix, label, short, description, featured }`.
L'élément `featured: true` occupe la grande carte. Le hero affiche les trois premiers éléments, avec le libellé `short`.

## `news` — Actualités et annonces

- `categories[]` : `{ id, label }`. Seules les catégories qui contiennent au moins une actualité apparaissent dans les filtres.
- `items[]` : `{ id, title, excerpt, category, date, image, url, featured, attachments[] }`.
  - `featured: true` place l'actualité en « une » ; sinon, c'est la plus récente.
  - `attachments[]` : `{ label, url }` (PDF des listes, etc.), dans une liste repliable. Elle est ouverte d'office s'il y a 3 documents ou moins.

## `services` — Services du campus

`items[]` : `{ id, icon, title, description, url }`, où `icon` ∈ chart, document, exam, graduate, info.

## `dean` — Mot du Doyen

`{ name, title, photo, quote, message[] (paragraphes), url }`.

## `faculty` — Corps enseignant

`items[]` : `{ id, name, title, department, photo, url }`. Les photos s'affichent en noir et blanc et passent en couleur au survol.

## `testimonials` — Ils parlent de nous

`items[]` : `{ id, platform: "youtube", videoId (11 caractères), title, author, description }`.
Le lecteur YouTube (youtube-nocookie) ne se charge qu'au clic. Si `videoId` est vide, la carte indique « Vidéo bientôt disponible ».
