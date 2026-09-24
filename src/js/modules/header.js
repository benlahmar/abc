/** Sticky header: toggles `data-scrolled` once the page leaves the top. */
export function initHeader(header) {
  if (!header) return;
  let ticking = false;

  const update = () => {
    header.toggleAttribute('data-scrolled', window.scrollY > 24);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}
