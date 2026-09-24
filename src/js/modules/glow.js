/** Fait suivre le pointeur au halo doré des cartes [data-glow]. */
export function initGlow(root = document) {
  root.querySelectorAll('[data-glow]:not([data-glow-ready])').forEach((card) => {
    card.setAttribute('data-glow-ready', '');
    let frame = 0;
    card.addEventListener('pointermove', (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    });
  });
}
