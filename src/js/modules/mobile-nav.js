/** Mobile navigation drawer built on the native <dialog> element. */
export function initMobileNav() {
  const toggle = document.querySelector('[data-mobile-toggle]');
  const dialog = document.querySelector('[data-mobile-nav]');
  if (!toggle || !dialog || typeof dialog.showModal !== 'function') return;

  const desktop = window.matchMedia('(min-width: 64rem)');

  toggle.addEventListener('click', () => {
    dialog.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
  });

  dialog.querySelector('[data-mobile-close]')?.addEventListener('click', () => dialog.close());

  // Close after following an in-page link.
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('a[href^="#"]')) dialog.close();
  });

  dialog.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    toggle.focus();
  });

  desktop.addEventListener('change', (event) => {
    if (event.matches && dialog.open) dialog.close();
  });
}
