# Portail FSBM — Page d'accueil

Page d'accueil de la **Faculté des Sciences Ben M'Sik** (Université Hassan II de Casablanca), construite avec
**Vite + Tailwind CSS v4** et des modules JavaScript sans dépendance. Tout le contenu provient de collections JSON,
prêtes à être servies par le futur back-office.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # site statique dans dist/
```

## Structure

```
index.html                  Squelette de la page ; sections assemblées via <include src="…" />
vite.config.js              Plugin Tailwind + mini-plugin d'inclusion HTML (sans dépendance)
public/data/*.json          Contenu : site, hero, programmes, stats, news, services, dean, faculty, testimonials
docs/modele-de-contenu.md   Schéma de chaque collection (référence pour le back-office)
src/styles/main.css         Jetons de design (@theme), styles de base, composants
src/partials/               Une section par fichier (en-tête, méga-menus, hero, programmes, chiffres…)
src/js/main.js              Démarrage : interface + remplissage des zones [data-render]
src/js/content/             Client de données, gabarits échappés (anti-XSS), formats fr-FR / arabe
src/js/sections/            Un module de rendu par section
src/js/modules/             Comportements : en-tête, méga-menu, menu mobile, média, compteurs, révélations
```

## Brancher le back-office

Définir `VITE_CONTENT_API_URL` dans `.env` (voir `.env.example`). Chaque collection est alors lue depuis
`<API>/<collection>` au lieu de `public/data/<collection>.json`. Les formats attendus sont décrits dans
[`docs/modele-de-contenu.md`](docs/modele-de-contenu.md).

## Charte

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `midnight` | `#0A192F` | Encre principale, surfaces sombres |
| `paper` | `#F8FAFC` | Fond de page |
| `muted` | `#64748B` | Texte secondaire |
| `gold` | `#C5A059` | Accents et états interactifs sur fond sombre |
| `bronze` | `#85652B` | Texte « doré » sur fond clair (conforme WCAG AA, contrairement à `gold`) |

Polices : Cormorant Garamond (titres), Inter (interface et chiffres), IBM Plex Sans Arabic (contenus en arabe).

## Accessibilité

- Lien d'évitement, régions nommées, `lang="fr"` ; les textes arabes reçoivent `lang="ar" dir="rtl"`.
- Méga-menus au modèle « disclosure » WAI-ARIA (clavier : Échap, ↓, ←/→). Le menu mobile utilise le `<dialog>` natif.
- Le carrousel « À la une » est manuel : aucun défilement automatique.
- Les compteurs animés n'exposent que leur valeur finale aux lecteurs d'écran.
- L'animation du hero a un bouton pause, et toutes les animations respectent `prefers-reduced-motion`.
