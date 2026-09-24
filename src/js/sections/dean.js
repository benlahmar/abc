import { getCollection } from '../content/client.js';
import { html, mount, raw, safeUrl } from '../content/template.js';
import { initials, langAttrs } from '../content/format.js';

/** Mot du Doyen (dean.json). */
export async function renderDean(el) {
  const dean = await getCollection('dean');
  const paragraphs = dean.message ?? [];

  mount(
    el,
    html`<div class="grid gap-14 lg:grid-cols-12 lg:gap-16">
      <figure class="relative mx-auto w-full max-w-sm lg:col-span-5 lg:mx-0 lg:max-w-none" data-reveal>
        <div class="relative">
        <span aria-hidden="true" class="absolute -right-4 -bottom-4 left-4 top-4 border border-gold/70"></span>
        <div class="relative aspect-[4/5] overflow-hidden bg-midnight">
          ${dean.photo
            ? html`<img src="${safeUrl(dean.photo, '')}" alt="Portrait de ${dean.name}" loading="lazy" decoding="async" class="size-full object-cover" />`
            : html`<div class="plate-grid grid size-full place-items-center" role="img" aria-label="Portrait de ${dean.name} (photo à venir)">
                <span class="font-serif text-[7rem] leading-none text-gold/90">${initials(dean.name)}</span>
              </div>`}
        </div>
        </div>
        <figcaption class="relative mt-10 lg:mt-12">
          <p class="font-serif text-[1.75rem] leading-none">${dean.name}</p>
          <p class="eyebrow mt-3">${dean.title}</p>
        </figcaption>
      </figure>

      <div class="lg:col-span-7 lg:pt-4" data-reveal style="--reveal-delay: 100ms">
        <p class="section-index">06 — Mot du Doyen</p>
        <h2 id="dean-title" class="sr-only">Mot du Doyen</h2>
        ${dean.quote
          ? html`<blockquote class="relative mt-10">
              <span aria-hidden="true" class="absolute -top-10 -left-2 font-serif text-[7rem] leading-none text-gold/50">“</span>
              <p class="relative font-serif text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[1.12] tracking-[-0.01em] text-balance"${raw(langAttrs(dean.quote))}>${dean.quote}</p>
            </blockquote>`
          : ''}
        <div class="mt-10 max-w-2xl space-y-5 border-t border-midnight/10 pt-8 text-[1rem] leading-[1.8] text-muted">
          ${paragraphs.map((p) => html`<p${raw(langAttrs(p))}>${p}</p>`)}
        </div>
        <a href="${safeUrl(dean.url)}" class="group mt-10 inline-flex items-center gap-3 border border-midnight/80 px-6 py-3 text-[0.8125rem] font-medium transition-colors hover:bg-midnight hover:text-paper">
          Lire le message complet <span class="arrow-nudge" aria-hidden="true">→</span>
        </a>
      </div>
    </div>`,
  );
}
