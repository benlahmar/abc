import { initHeader } from './modules/header.js';
import { initMegaMenu } from './modules/mega-menu.js';
import { initMobileNav } from './modules/mobile-nav.js';
import { initMedia } from './modules/media.js';
import { initReveal } from './modules/reveal.js';
import { initGlow } from './modules/glow.js';
import { html, mount } from './content/template.js';
import { bindSite, renderSocials, renderAddress } from './sections/site.js';
import { renderHeroSlides } from './sections/hero-slides.js';
import { renderProgrammes } from './sections/programmes.js';
import { renderStats, renderHeroFacts } from './sections/stats.js';
import { renderNews } from './sections/news.js';
import { renderServices } from './sections/services.js';
import { renderDean } from './sections/dean.js';
import { renderFaculty } from './sections/faculty.js';
import { renderTestimonials } from './sections/testimonials.js';

window.__fsBooted = true;

// Interface
const header = document.querySelector('[data-header]');
initHeader(header);
initMegaMenu(header);
initMobileNav();
initMedia(document.querySelector('[data-media]'));
initReveal();
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

// Contenu dynamique : chaque [data-render="nom"] est rempli par son module.
const renderers = {
  socials: renderSocials,
  address: renderAddress,
  'hero-slides': renderHeroSlides,
  'hero-facts': renderHeroFacts,
  programmes: renderProgrammes,
  stats: renderStats,
  news: renderNews,
  services: renderServices,
  dean: renderDean,
  faculty: renderFaculty,
  testimonials: renderTestimonials,
};

async function hydrate(el, render) {
  el.setAttribute('aria-busy', 'true');
  try {
    await render(el);
  } catch (error) {
    console.error(error);
    // Les zones avec contenu de repli statique (adresse, repères) gardent leur HTML initial.
    if (el.querySelector('.skeleton') || el.matches('[data-render="news"], [data-render="dean"]')) {
      mount(el, html`<p class="content-error">Ce contenu est momentanément indisponible. Veuillez réessayer plus tard.</p>`);
    }
  } finally {
    el.removeAttribute('aria-busy');
    initReveal(el);
    initGlow(el);
  }
}

bindSite().catch((error) => console.error(error));
document.querySelectorAll('[data-render]').forEach((el) => {
  const render = renderers[el.dataset.render];
  if (render) hydrate(el, render);
});
