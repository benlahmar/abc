import { getCollection } from '../content/client.js';
import { html, mount, raw, safeUrl } from '../content/template.js';
import { formatDate, langAttrs } from '../content/format.js';
import { initReveal } from '../modules/reveal.js';
import { prefersReducedMotion } from '../modules/motion.js';

/**
 * Actualités et annonces (news.json).
 * Structure : article à la une + 3 brèves, puis une grille « Afficher plus ».
 */
const SIDE_COUNT = 3;
const PAGE_SIZE = 6;
const PLATES = { recherche: 'plate-rings', campus: 'plate-grid', partenariat: 'plate-helix', evenements: 'plate-dots', services: 'plate-strata', reussite: 'plate-rings' };

const docIcon = raw('<svg aria-hidden="true" viewBox="0 0 16 16" class="size-3.5 shrink-0"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z M9.5 1.5v3h3M6 8h4.5M6 10.5h4.5" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>');

function visual(item, category, big) {
  if (item.image) {
    return html`<img src="${safeUrl(item.image, '')}" alt="" loading="lazy" decoding="async" class="size-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.03]" />`;
  }
  return html`<span class="plate ${PLATES[item.category] ?? 'plate-grid'} absolute inset-0"></span>
    <span class="absolute inset-0 bg-gradient-to-t from-midnight/70 via-transparent to-transparent"></span>
    ${big
      ? html`<span class="absolute bottom-6 left-6 font-serif text-[clamp(2.5rem,6vw,4.5rem)] leading-none text-paper/90">${category}</span>
          <span class="absolute top-6 right-6 font-mono text-[0.625rem] tracking-widest text-paper/60 uppercase">FSBM — ${formatDate(item.date)}</span>`
      : html`<span class="absolute bottom-1.5 left-2 font-mono text-[0.5625rem] tracking-widest text-paper/70 uppercase">FSBM</span>`}`;
}

function attachments(item, compact) {
  const docs = item.attachments ?? [];
  if (!docs.length) return '';
  const label = `${docs.length} document${docs.length > 1 ? 's' : ''} joint${docs.length > 1 ? 's' : ''}`;
  return html`<details class="group/att mt-4 border-t border-midnight/10 pt-3"${raw(docs.length <= 3 && !compact ? ' open' : '')}>
    <summary class="flex cursor-pointer list-none items-center gap-2 text-[0.75rem] font-medium text-midnight transition-colors hover:text-bronze [&::-webkit-details-marker]:hidden">
      ${docIcon} ${label}
      <span aria-hidden="true" class="ml-auto text-sm text-bronze transition-transform duration-300 group-open/att:rotate-45">+</span>
    </summary>
    <ul class="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-[0.75rem] text-muted ${compact ? '' : 'sm:grid-cols-3'}">
      ${docs.map(
        (d) => html`<li><a href="${safeUrl(d.url)}" class="inline-flex items-center gap-1.5 transition-colors hover:text-midnight" target="_blank" rel="noopener">${docIcon}<span class="link-rule">${d.label}</span><span class="sr-only"> (${item.title}, nouvel onglet)</span></a></li>`,
      )}
    </ul>
  </details>`;
}

const meta = (item, category) => html`<p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
  <span class="font-semibold tracking-eyebrow text-bronze uppercase">${category}</span>
  <span aria-hidden="true" class="h-px w-4 bg-midnight/20"></span>
  <time datetime="${item.date}" class="text-muted">${formatDate(item.date)}</time>
</p>`;

const lead = (item, category) => html`<article class="group lg:col-span-7 lg:pr-14" data-reveal>
  <a href="${safeUrl(item.url)}" tabindex="-1" aria-hidden="true" class="relative block aspect-[16/9] overflow-hidden bg-midnight">
    ${visual(item, category, true)}
    <span class="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-700 ease-editorial group-hover:scale-x-100"></span>
  </a>
  <div class="mt-7">${meta(item, category)}</div>
  <h3 class="mt-4 font-serif text-[clamp(1.8rem,2.8vw,2.5rem)] leading-[1.08] tracking-[-0.01em] text-balance"${raw(langAttrs(item.title))}>
    <a href="${safeUrl(item.url)}" class="link-rule">${item.title}</a>
  </h3>
  ${item.excerpt ? html`<p class="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-muted"${raw(langAttrs(item.excerpt))}>${item.excerpt}</p>` : ''}
  ${attachments(item, false)}
  <a href="${safeUrl(item.url)}" class="mt-6 inline-flex items-center gap-2 text-[0.8125rem] font-medium">
    <span class="link-rule">Lire la suite</span><span class="arrow-nudge text-bronze" aria-hidden="true">→</span><span class="sr-only"> : ${item.title}</span>
  </a>
</article>`;

const brief = (item, category) => html`<article class="group grid grid-cols-[5rem_1fr] gap-5 border-b border-midnight/10 py-6 sm:grid-cols-[6rem_1fr]" data-reveal>
  <a href="${safeUrl(item.url)}" tabindex="-1" aria-hidden="true" class="relative block aspect-square overflow-hidden bg-midnight">${visual(item, category, false)}</a>
  <div class="min-w-0">
    ${meta(item, category)}
    <h3 class="mt-2 font-serif text-[1.3rem] leading-[1.18]"${raw(langAttrs(item.title))}><a href="${safeUrl(item.url)}" class="link-rule">${item.title}</a></h3>
    ${item.excerpt ? html`<p class="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted"${raw(langAttrs(item.excerpt))}>${item.excerpt}</p>` : ''}
    ${attachments(item, true)}
  </div>
</article>`;

export async function renderNews(el) {
  const { categories = [], items = [] } = await getCollection('news');
  const section = el.closest('[data-news]');
  const filters = section.querySelector('[data-news-filters]');
  const status = section.querySelector('[data-news-status]');
  const more = section.querySelector('[data-news-more]');
  const labelOf = Object.fromEntries(categories.map((c) => [c.id, c.label]));
  const sorted = [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const counts = sorted.reduce((acc, it) => ({ ...acc, [it.category]: (acc[it.category] ?? 0) + 1 }), {});
  const available = categories.filter((c) => counts[c.id]);
  mount(
    filters,
    html`<button type="button" class="feed-chip" aria-pressed="true" data-filter="all">Toutes <span class="text-muted/70">${sorted.length}</span></button>
      ${available.map((c) => html`<button type="button" class="feed-chip" aria-pressed="false" data-filter="${c.id}">${c.label} <span class="text-muted/70">${counts[c.id]}</span></button>`)}`,
  );

  let filter = 'all';
  let extra = 0;

  const render = ({ focusNew = false } = {}) => {
    const list = filter === 'all' ? sorted : sorted.filter((it) => it.category === filter);
    const featured = list.find((it) => it.featured) ?? list[0];
    const rest = list.filter((it) => it !== featured);
    const side = rest.slice(0, SIDE_COUNT);
    const grid = rest.slice(SIDE_COUNT, SIDE_COUNT + extra);
    const cat = (it) => labelOf[it.category] ?? it.category;

    if (!featured) {
      mount(el, html`<p class="content-error lg:col-span-12">Aucune actualité publiée pour le moment.</p>`);
    } else {
      mount(
        el,
        html`${lead(featured, cat(featured))}
          ${side.length ? html`<div class="lg:col-span-5 lg:border-l lg:border-midnight/10 lg:pl-14 [&>article:first-child]:pt-0">${side.map((it) => brief(it, cat(it)))}</div>` : ''}
          ${grid.length ? html`<div class="grid gap-x-10 border-t border-midnight/10 pt-4 md:grid-cols-2 lg:col-span-12 lg:mt-10 xl:grid-cols-3" data-news-grid>${grid.map((it) => brief(it, cat(it)))}</div>` : ''}`,
      );
    }

    const remaining = rest.length - side.length - grid.length;
    more.hidden = remaining <= 0;
    status.textContent = `${list.length} actualité${list.length > 1 ? 's' : ''}${filter === 'all' ? '' : ` · ${labelOf[filter]}`}`;
    initReveal(el);
    if (focusNew) el.querySelector('[data-news-grid] article:last-child a[href]:not([tabindex])')?.focus({ preventScroll: true });
  };

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button || button.dataset.filter === filter) return;
    filter = button.dataset.filter;
    extra = 0;
    filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    render();
    if (!prefersReducedMotion()) el.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  });

  more.addEventListener('click', () => {
    extra += PAGE_SIZE;
    render();
  });

  render();
}
