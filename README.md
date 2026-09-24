# Faculty of Science — Homepage

An editorial, accessible homepage for a university Faculty of Science portal, built with **Vite + Tailwind CSS v4** and dependency-free vanilla JS modules.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

## Structure

```
index.html                 Page shell. Sections are composed with <include src="…" />
vite.config.js             Tailwind plugin + a tiny zero-dependency HTML partials plugin
src/styles/main.css        Design tokens (@theme), base styles, component classes
src/partials/
  header.html              Sticky frosted header, utility bar, mega-menu triggers
  mega-{academics,research,campus}.html
  mobile-nav.html          Native <dialog> drawer with <details> accordions
  hero.html                Asymmetric hero + masked cinematic media container
  impact.html              Bento grid of live statistics
  feed.html                Breakthroughs (filterable) | International symposia
  footer.html
src/js/main.js             Boots every module
src/js/modules/            header, mega-menu, mobile-nav, media, stats, glow, feed, reveal, motion
```

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `midnight` | `#0A192F` | Primary ink, dark surfaces |
| `paper` | `#F8FAFC` | Page background |
| `muted` | `#64748B` | Secondary text |
| `gold` | `#C5A059` | Accents and interactive states on dark surfaces |
| `bronze` | `#85652B` | Gold-family **text** on light surfaces (meets WCAG AA; `gold` alone does not) |

Typefaces: Cormorant Garamond (editorial headings) and Inter (UI and body).

## Swapping in real content

- **Hero video:** replace the generative scene in `hero.html` with the commented `<video>` block. The pause control and timecode already handle a video element.
- **Live statistics:** set `data-live-endpoint` on the `#impact` section to a JSON URL such as `{ "publications": 4813, "updated": "…" }`; it is polled every 60 s. **Remove `data-live-demo`** in production. That attribute simulates new publications for demonstration only.
- All names, figures and stories are placeholder content for a fictional institution.

## Accessibility

- Skip link, landmark regions, and labelled sections.
- Mega menus follow the WAI-ARIA disclosure pattern: `aria-expanded`, `aria-controls`, and `inert` on closed panels. Supported keys: Esc, ArrowDown, ArrowLeft and ArrowRight. Menus close on an outside click or when focus leaves the header.
- The mobile menu uses a native modal `<dialog>`, which traps focus and restores it on close.
- Animated counters expose only their final value to screen readers. Charts have text alternatives.
- The looping hero media has a pause control (WCAG 2.2.2). All motion respects `prefers-reduced-motion`.
- Reveal animations are progressive enhancement: if JS fails to boot, content stays visible.
