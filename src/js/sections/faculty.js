import { getCollection } from '../content/client.js';
import { html, mount, safeUrl } from '../content/template.js';
import { initials } from '../content/format.js';

/** Corps enseignant (faculty.json). */
export async function renderFaculty(el) {
  const { items = [] } = await getCollection('faculty');
  mount(
    el,
    items.map(
      (p, i) => html`<li class="group relative" data-reveal style="--reveal-delay: ${i * 70}ms">
        <div class="relative aspect-[4/5] overflow-hidden bg-midnight">
          ${p.photo
            ? html`<img src="${safeUrl(p.photo, '')}" alt="" loading="lazy" decoding="async" class="size-full object-cover grayscale transition duration-700 ease-editorial group-hover:scale-[1.03] group-hover:grayscale-0" />`
            : html`<div class="plate-dots grid size-full place-items-center" aria-hidden="true"><span class="font-serif text-6xl text-paper/80">${initials(p.name)}</span></div>`}
          <span aria-hidden="true" class="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-500 ease-editorial group-hover:scale-x-100"></span>
        </div>
        <h3 class="mt-5 font-serif text-[1.35rem] leading-tight">
          <a href="${safeUrl(p.url)}" class="link-rule after:absolute after:inset-0">${p.name}</a>
        </h3>
        <p class="mt-1.5 text-[0.8125rem] text-muted">${p.title}${p.department ? html` · ${p.department}` : ''}</p>
      </li>`,
    ),
  );
}
