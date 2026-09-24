import { getCollection } from '../content/client.js';
import { html, mount, raw } from '../content/template.js';
import { langAttrs } from '../content/format.js';

/**
 * Témoignages vidéo (testimonials.json).
 * Le lecteur YouTube (domaine youtube-nocookie) n'est chargé qu'au clic : pas de traceurs ni de
 * poids inutile au chargement de la page.
 */
const VALID_ID = /^[\w-]{11}$/;
const playIcon = raw('<svg aria-hidden="true" viewBox="0 0 20 20" class="size-5 translate-x-px"><path d="M6 3.5v13L16.5 10z" fill="currentColor"/></svg>');

export async function renderTestimonials(el) {
  const { items = [] } = await getCollection('testimonials');
  mount(
    el,
    items.map((t, i) => {
      const playable = t.platform === 'youtube' && VALID_ID.test(t.videoId ?? '');
      return html`<li class="group flex flex-col" data-reveal style="--reveal-delay: ${i * 80}ms">
        <div class="relative aspect-video overflow-hidden bg-midnight-950" data-player>
          ${playable
            ? html`<button type="button" data-video-id="${t.videoId}" data-video-title="${t.title}" class="absolute inset-0 size-full cursor-pointer">
                <img src="https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg" alt="" loading="lazy" decoding="async" class="size-full object-cover opacity-80 transition duration-700 ease-editorial group-hover:scale-[1.03] group-hover:opacity-100" />
                <span class="absolute inset-0 grid place-items-center">
                  <span class="grid size-14 place-items-center bg-paper text-midnight transition-colors duration-300 group-hover:bg-gold">${playIcon}</span>
                </span>
                <span class="sr-only">Lire la vidéo : ${t.title}</span>
              </button>`
            : html`<div class="plate-rings absolute inset-0 opacity-70" aria-hidden="true"></div>
                <p class="absolute bottom-4 left-4 font-mono text-[0.625rem] tracking-widest text-paper/60 uppercase">Vidéo bientôt disponible</p>`}
        </div>
        <div class="flex flex-1 flex-col border-x border-b border-paper/10 p-6">
          <p class="text-[0.625rem] font-semibold tracking-eyebrow text-gold uppercase">${t.author}</p>
          <h3 class="mt-3 font-serif text-[1.3rem] leading-snug"${raw(langAttrs(t.title))}>${t.title}</h3>
          ${t.description ? html`<p class="mt-3 line-clamp-2 text-[0.8125rem] leading-relaxed text-paper/60"${raw(langAttrs(t.description))}>${t.description}</p>` : ''}
        </div>
      </li>`;
    }),
  );

  el.addEventListener('click', (event) => {
    const button = event.target.closest('[data-video-id]');
    if (!button) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${button.dataset.videoId}?autoplay=1&rel=0`;
    iframe.title = button.dataset.videoTitle;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.className = 'absolute inset-0 size-full';
    button.replaceWith(iframe);
    iframe.focus();
  });
}
