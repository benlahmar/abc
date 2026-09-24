import { prefersReducedMotion } from './motion.js';

/** Discipline filter for the Breakthroughs list (toggle-button group). */
export function initFeed(feed) {
  if (!feed) return;

  const buttons = [...feed.querySelectorAll('[data-filter]')];
  const items = [...feed.querySelectorAll('[data-discipline]')];
  const status = feed.querySelector('[data-feed-status]');
  const empty = feed.querySelector('[data-feed-empty]');

  const apply = (button) => {
    const filter = button.dataset.filter;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));

    const shown = items.filter((item) => {
      const match = filter === 'all' || item.dataset.discipline === filter;
      item.hidden = !match;
      return match;
    });

    if (empty) empty.hidden = shown.length > 0;

    if (!prefersReducedMotion()) {
      shown.forEach((item, i) =>
        item.animate(
          [
            { opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 500, delay: i * 50, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
        ),
      );
    }

    if (status) {
      const label = filter === 'all' ? 'all disciplines' : button.textContent.trim();
      status.textContent = `Showing ${shown.length} ${shown.length === 1 ? 'story' : 'stories'} in ${label}.`;
    }
  };

  buttons.forEach((button) => button.addEventListener('click', () => apply(button)));
}
