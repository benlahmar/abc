import { initHeader } from './modules/header.js';
import { initMegaMenu } from './modules/mega-menu.js';
import { initMobileNav } from './modules/mobile-nav.js';
import { initMedia } from './modules/media.js';
import { initReveal } from './modules/reveal.js';
import { initStats } from './modules/stats.js';
import { initGlow } from './modules/glow.js';
import { initFeed } from './modules/feed.js';

window.__fsBooted = true;

const header = document.querySelector('[data-header]');
initHeader(header);
initMegaMenu(header);
initMobileNav();
initMedia(document.querySelector('[data-media]'));
initStats(document.querySelector('[data-stats]'));
initGlow();
initFeed(document.querySelector('[data-feed]'));
initReveal();

document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
