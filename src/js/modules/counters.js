import { easeOutExpo, onceVisible, prefersReducedMotion } from './motion.js';
import { formatNumber } from '../content/format.js';

const DURATION = 1800;

/**
 * Anime de 0 à leur valeur les éléments [data-count] de `root` lorsqu'ils deviennent visibles.
 * Les lecteurs d'écran reçoivent directement la valeur finale.
 */
export function initCounters(root) {
  const counters = [...root.querySelectorAll('[data-count]')].map((el) => {
    const target = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals ?? 0);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = formatNumber(target, decimals);
    el.after(sr);
    el.setAttribute('aria-hidden', 'true');
    return { el, target, decimals };
  });
  if (!counters.length || prefersReducedMotion()) return;

  counters.forEach((c) => (c.el.textContent = formatNumber(0, c.decimals)));
  onceVisible(root, () => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      counters.forEach((c) => (c.el.textContent = formatNumber(c.target * easeOutExpo(t), c.decimals)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
