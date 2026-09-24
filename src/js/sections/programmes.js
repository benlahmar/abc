import { getCollection } from '../content/client.js';
import { html, mount, safeUrl } from '../content/template.js';
import { pad2 } from '../content/format.js';

/** Grille « Nos programmes » (programmes.json). */
export async function renderProgrammes(el) {
  const { items = [] } = await getCollection('programmes');
  mount(
    el,
    items.map(
      (p, i) => html`<li
        data-glow
        data-reveal
        style="--reveal-delay: ${(i % 3) * 70}ms"
        class="glow-card group relative flex min-h-[19rem] flex-col border-r border-b border-midnight/10 bg-paper p-8 transition-colors duration-500 hover:bg-white sm:p-10"
      >
        <span aria-hidden="true" class="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-500 ease-editorial group-hover:scale-x-100"></span>
        <div class="flex items-start justify-between gap-4">
          <span class="font-mono text-[0.6875rem] text-muted" aria-hidden="true">${pad2(i + 1)}</span>
          ${Number.isFinite(p.count)
            ? html`<span class="border border-gold/60 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-bronze">${p.count} formation${p.count > 1 ? 's' : ''}</span>`
            : ''}
        </div>
        <h3 class="mt-12 font-serif text-[2rem] leading-none tracking-tight">${p.title}</h3>
        <p class="mt-4 text-[0.9375rem] leading-relaxed text-muted">${p.description}</p>
        <a href="${safeUrl(p.url)}" class="mt-auto inline-flex items-center gap-2 pt-8 text-[0.8125rem] font-medium after:absolute after:inset-0">
          <span class="link-rule">Découvrir</span><span class="arrow-nudge text-bronze" aria-hidden="true">→</span>
          <span class="sr-only"> : ${p.title}</span>
        </a>
      </li>`,
    ),
  );
}
