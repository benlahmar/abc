/** Tracks the pointer across bento cards so the gold border glow follows it. */
export function initGlow(root = document) {
  root.querySelectorAll('[data-glow]').forEach((card) => {
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
