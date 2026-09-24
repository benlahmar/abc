import { onceVisible, prefersReducedMotion } from './motion.js';

/** Fait apparaître les blocs éditoriaux à leur entrée dans la fenêtre. */
export function initReveal(root = document) {
  const targets = root.querySelectorAll('[data-reveal]:not([data-visible])');
  if (prefersReducedMotion()) {
    targets.forEach((el) => el.setAttribute('data-visible', ''));
    return;
  }
  targets.forEach((el) => onceVisible(el, () => el.setAttribute('data-visible', '')));
}
