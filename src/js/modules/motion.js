/** Shared motion helpers. */
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export const prefersReducedMotion = () => reducedQuery.matches;

export const easeOutExpo = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * Run `callback` once the first time `el` scrolls into view.
 * Returns a disposer.
 */
export function onceVisible(el, callback, options = { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }) {
  if (!('IntersectionObserver' in window)) {
    callback(el);
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        io.disconnect();
        callback(entry.target);
      }
    }
  }, options);
  io.observe(el);
  return () => io.disconnect();
}
