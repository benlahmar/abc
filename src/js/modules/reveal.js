import { onceVisible, prefersReducedMotion } from './motion.js';

/** Fades editorial blocks in as they enter the viewport. */
export function initReveal(root = document) {
  const targets = root.querySelectorAll('[data-reveal]');
  if (prefersReducedMotion()) {
    targets.forEach((el) => el.setAttribute('data-visible', ''));
    return;
  }
  targets.forEach((el) => onceVisible(el, () => el.setAttribute('data-visible', '')));
}
