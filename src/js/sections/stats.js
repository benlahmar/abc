import { getCollection } from '../content/client.js';
import { html, mount } from '../content/template.js';
import { formatNumber } from '../content/format.js';
import { initCounters } from '../modules/counters.js';

const value = (s, big) => html`<p class="${big
    ? 'figure text-[clamp(4.25rem,10vw,8.5rem)] leading-[0.85]'
    : 'figure mt-8 text-[3.5rem] leading-none'}">
    ${s.prefix ? html`<span class="${big ? 'text-gold' : 'text-bronze'}">${s.prefix}</span>` : ''}<span data-count="${s.value}">${formatNumber(s.value)}</span>${s.suffix ? html`<span class="${big ? 'text-gold' : 'text-bronze'}">${s.suffix}</span>` : ''}
  </p>`;

/** Grille bento des chiffres clés (stats.json). */
export async function renderStats(el) {
  const { items = [], year } = await getCollection('stats');
  const section = el.closest('section');
  const yearEl = section?.querySelector('[data-bind="stats.year"]');
  if (yearEl && year) yearEl.textContent = `(${year})`;

  const featured = items.find((s) => s.featured) ?? items[0];
  const others = items.filter((s) => s !== featured);

  mount(
    el,
    html`${featured
        ? html`<article data-glow data-reveal class="glow-card on-dark relative flex min-h-[22rem] flex-col justify-between overflow-hidden bg-midnight p-8 text-paper sm:col-span-2 sm:p-10 lg:col-span-6 lg:row-span-2">
            <div aria-hidden="true" class="plate-dots absolute inset-y-0 right-0 w-1/2 opacity-40 [mask-image:linear-gradient(to_left,#000,transparent)]"></div>
            <div class="relative flex items-center justify-between gap-4">
              <h3 class="text-[0.6875rem] font-semibold tracking-eyebrow text-gold uppercase">${featured.label}</h3>
              ${year ? html`<span class="text-[0.6875rem] text-paper/50">${year}</span>` : ''}
            </div>
            <div class="relative">
              ${value(featured, true)}
              <p class="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-paper/65">${featured.description}</p>
            </div>
          </article>`
        : ''}
      ${others.map(
        (s, i) => html`<article data-glow data-reveal style="--reveal-delay: ${(i + 1) * 70}ms" class="glow-card flex flex-col justify-between border border-midnight/10 bg-paper p-7 lg:col-span-3">
          <h3 class="eyebrow">${s.label}</h3>
          <div>
            ${value(s, false)}
            <p class="mt-3 text-sm text-muted">${s.description}</p>
          </div>
        </article>`,
      )}`,
  );
  initCounters(el);
}

/** Repères du hero : trois premiers indicateurs (champ « short » si présent). */
export async function renderHeroFacts(el) {
  const { items = [] } = await getCollection('stats');
  mount(
    el,
    items.slice(0, 3).map(
      (s, i) => html`<div class="${i ? 'border-l border-midnight/10 pl-5' : ''}">
        <dt class="eyebrow">${s.short || s.label}</dt>
        <dd class="figure mt-2 text-2xl">${s.prefix ?? ''}${formatNumber(s.value)}${s.suffix ?? ''}</dd>
      </div>`,
    ),
  );
}
