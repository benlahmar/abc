import { getCollection } from '../content/client.js';
import { html, mount, raw, safeUrl } from '../content/template.js';

/** Services du campus (services.json). */
const ICONS = {
  chart: '<path d="M3 17V9M8.5 17V4M14 17v-6M19 17V7M2 19.5h18" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  document: '<path d="M5.5 2.5h7.5l4 4v13h-11.5z M13 2.5v4h4M8.5 11h6M8.5 14h6M8.5 17h4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  exam: '<path d="M4 3.5h14v16H4z M7.5 8.5l1.5 1.5 3-3M7.5 14.5l1.5 1.5 3-3M14 9h1.5M14 15h1.5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  graduate: '<path d="m11 4 9.5 4.5L11 13 1.5 8.5z M5.5 10.5v5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-5M20.5 8.5v6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  info: '<circle cx="11" cy="11" r="8.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M11 10v5.5M11 6.5v1" stroke="currentColor" stroke-width="1.5"/>',
};

export async function renderServices(el) {
  const { items = [] } = await getCollection('services');
  mount(
    el,
    items.map(
      (s, i) => html`<li data-glow data-reveal style="--reveal-delay: ${i * 70}ms" class="glow-card group relative flex min-h-[15rem] flex-col border border-midnight/10 bg-paper p-7 transition-colors duration-500 hover:bg-white">
        <span aria-hidden="true" class="grid size-12 place-items-center border border-midnight/10 text-midnight transition-colors duration-500 group-hover:border-gold group-hover:bg-midnight group-hover:text-gold">
          <svg viewBox="0 0 22 22" class="size-5">${raw(ICONS[s.icon] ?? ICONS.info)}</svg>
        </span>
        <h3 class="mt-8 font-serif text-[1.45rem] leading-[1.15]">${s.title}</h3>
        ${s.description ? html`<p class="mt-3 text-[0.8125rem] leading-relaxed text-muted">${s.description}</p>` : ''}
        <a href="${safeUrl(s.url)}" class="mt-auto inline-flex items-center gap-2 pt-6 text-[0.8125rem] font-medium after:absolute after:inset-0">
          <span class="link-rule">En savoir plus</span><span class="arrow-nudge text-bronze" aria-hidden="true">→</span><span class="sr-only"> : ${s.title}</span>
        </a>
      </li>`,
    ),
  );
}
