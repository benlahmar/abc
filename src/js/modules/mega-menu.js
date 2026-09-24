/**
 * Mega menu — WAI-ARIA disclosure pattern.
 *  - Click / Enter / Space toggles; ArrowDown opens and focuses the first link.
 *  - ArrowLeft / ArrowRight move between top-level triggers.
 *  - Escape closes and returns focus to the trigger.
 *  - Hover intent on fine pointers; closes on outside click or when focus leaves the header.
 */
const HOVER_OPEN_DELAY = 110;
const HOVER_CLOSE_DELAY = 220;

export function initMegaMenu(header) {
  const triggers = [...(header?.querySelectorAll('[data-mega-trigger]') ?? [])];
  if (!triggers.length) return;

  const scrim = document.querySelector('[data-mega-scrim]');
  const desktop = window.matchMedia('(min-width: 64rem)');
  const panelFor = (trigger) => document.getElementById(trigger.getAttribute('aria-controls'));

  let current = null;
  let openTimer;
  let closeTimer;
  let hoverOpenedAt = 0;

  const setState = (trigger, isOpen) => {
    const panel = panelFor(trigger);
    trigger.setAttribute('aria-expanded', String(isOpen));
    panel.toggleAttribute('data-open', isOpen);
    panel.inert = !isOpen;
  };

  const open = (trigger) => {
    clearTimeout(closeTimer);
    if (current === trigger) return;
    if (current) setState(current, false);
    setState(trigger, true);
    current = trigger;
    scrim?.toggleAttribute('data-open', true);
  };

  const close = ({ returnFocus = false } = {}) => {
    clearTimeout(openTimer);
    if (!current) return;
    const trigger = current;
    setState(trigger, false);
    current = null;
    scrim?.removeAttribute('data-open');
    if (returnFocus) trigger.focus();
  };

  triggers.forEach((trigger, index) => {
    trigger.addEventListener('click', () => {
      // A click right after hover-open should not immediately close the panel.
      if (current === trigger && performance.now() - hoverOpenedAt > 450) close();
      else open(trigger);
    });

    trigger.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (step) {
        event.preventDefault();
        const next = triggers[(index + step + triggers.length) % triggers.length];
        if (current) open(next);
        next.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        open(trigger);
        panelFor(trigger).querySelector('a, button')?.focus();
      }
    });

    trigger.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        if (current !== trigger) hoverOpenedAt = performance.now();
        open(trigger);
      }, current ? 0 : HOVER_OPEN_DELAY);
    });
    trigger.addEventListener('pointerleave', () => clearTimeout(openTimer));
  });

  header.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  header.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(openTimer);
    closeTimer = setTimeout(close, HOVER_CLOSE_DELAY);
  });

  header.addEventListener('focusout', (event) => {
    if (current && !header.contains(event.relatedTarget)) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && current) {
      close({ returnFocus: header.contains(document.activeElement) });
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (current && !header.contains(event.target)) close();
  });

  desktop.addEventListener('change', () => close());
}
