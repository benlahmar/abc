import { getCollection } from '../content/client.js';
import { html, mount, raw, safeUrl } from '../content/template.js';
import { langAttrs, pad2 } from '../content/format.js';

/** Carrousel « À la une » (hero.json) — navigation manuelle, sans défilement automatique. */
export async function renderHeroSlides(root) {
  const { slides = [] } = await getCollection('hero');
  if (!slides.length) {
    root.hidden = true;
    return;
  }

  const track = root.querySelector('[data-slides]');
  const counter = root.querySelector('[data-slide-counter]');
  const progress = root.querySelector('[data-slide-progress]');
  const prev = root.querySelector('[data-slide-prev]');
  const next = root.querySelector('[data-slide-next]');

  mount(
    track,
    slides.map(
      (slide, i) => html`<article
        data-slide
        aria-roledescription="diapositive"
        aria-label="${i + 1} sur ${slides.length}"
        class="col-start-1 row-start-1 transition-[opacity,translate] duration-500 ease-editorial"
      >
        ${slide.kicker ? html`<p class="text-[0.6875rem] font-semibold tracking-eyebrow text-muted uppercase">${slide.kicker}</p>` : ''}
        <h2 class="mt-3 line-clamp-4 font-serif text-[1.5rem] leading-[1.15] text-balance"${raw(langAttrs(slide.title))}>
          <a href="${safeUrl(slide.url)}" class="link-rule">${slide.title}</a>
        </h2>
        ${slide.subtitle ? html`<p class="mt-3 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted"${raw(langAttrs(slide.subtitle))}>${slide.subtitle}</p>` : ''}
        <a href="${safeUrl(slide.url)}" class="group mt-5 inline-flex items-center gap-2 text-[0.8125rem] font-medium text-bronze">
          ${slide.cta || 'Voir plus'} <span class="arrow-nudge" aria-hidden="true">→</span>
          <span class="sr-only"> : ${slide.title}</span>
        </a>
      </article>`,
    ),
  );

  const items = [...track.querySelectorAll('[data-slide]')];
  progress.innerHTML = items.map(() => '<span class="h-px flex-1 bg-midnight/15 transition-colors duration-500"></span>').join('');
  const bars = [...progress.children];
  let index = 0;

  const show = (target) => {
    index = (target + items.length) % items.length;
    items.forEach((item, i) => {
      const active = i === index;
      item.inert = !active;
      item.classList.toggle('invisible', !active);
      item.classList.toggle('opacity-0', !active);
      item.classList.toggle('translate-y-2', !active);
    });
    bars.forEach((bar, i) => {
      bar.classList.toggle('bg-gold', i === index);
      bar.classList.toggle('bg-midnight/15', i !== index);
    });
    if (counter) counter.textContent = `${pad2(index + 1)} / ${pad2(items.length)}`;
  };

  if (items.length < 2) {
    prev.hidden = next.hidden = true;
  } else {
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    root.addEventListener('keydown', (event) => {
      if (event.target.closest('a')) return;
      if (event.key === 'ArrowLeft') show(index - 1);
      if (event.key === 'ArrowRight') show(index + 1);
    });
  }
  show(0);
}
