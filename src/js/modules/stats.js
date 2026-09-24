import { easeOutExpo, onceVisible, prefersReducedMotion } from './motion.js';

/**
 * Impact statistics.
 *  - [data-count]      counts up from zero when the section enters view.
 *  - [data-live-key]   is refreshed from the JSON at `data-live-endpoint`
 *                      (e.g. { "publications": 4813, "updated": "2026-09-24T10:02:00Z" }).
 *  - `data-live-demo`  on the section simulates occasional new records (demo only).
 */
const POLL_INTERVAL = 60_000;
const COUNT_DURATION = 1800;

const formatters = new Map();
const format = (value, decimals) => {
  if (!formatters.has(decimals)) {
    formatters.set(
      decimals,
      new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    );
  }
  return formatters.get(decimals).format(value);
};

/** Wraps a counter so assistive tech reads the final value, never the animation. */
function prepareCounter(el) {
  const decimals = Number(el.dataset.decimals ?? 0);
  const target = Number(el.dataset.count);
  const srValue = document.createElement('span');
  srValue.className = 'sr-only';
  srValue.textContent = format(target, decimals);
  el.after(srValue);
  el.setAttribute('aria-hidden', 'true');
  return { el, srValue, decimals, value: target };
}

function animate(counter, from, to, duration = COUNT_DURATION) {
  counter.value = to;
  counter.srValue.textContent = format(to, counter.decimals);
  if (prefersReducedMotion() || duration === 0) {
    counter.el.textContent = format(to, counter.decimals);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    counter.el.textContent = format(from + (to - from) * easeOutExpo(t), counter.decimals);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function initStats(section) {
  if (!section) return;

  const counters = [...section.querySelectorAll('[data-count]')].map(prepareCounter);
  const updatedEl = section.querySelector('[data-live-updated]');
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let updatedAt = new Date();

  // Paint zeros until the section is seen, then count up.
  if (!prefersReducedMotion()) counters.forEach((c) => (c.el.textContent = format(0, c.decimals)));

  onceVisible(section, () => {
    section.setAttribute('data-visible', '');
    counters.forEach((c) => animate(c, 0, c.value));
  });

  const renderUpdated = () => {
    if (!updatedEl) return;
    const minutes = Math.round((updatedAt - Date.now()) / 60_000);
    updatedEl.dateTime = updatedAt.toISOString();
    updatedEl.textContent = minutes === 0 ? 'just now' : rtf.format(minutes, 'minute');
  };

  const applyLive = (key, next) => {
    const counter = counters.find((c) => c.el.dataset.liveKey === key);
    if (!counter || !Number.isFinite(next) || next === counter.value) return;
    animate(counter, counter.value, next, 900);
    counter.el.classList.add('text-bronze');
    setTimeout(() => counter.el.classList.remove('text-bronze'), 1400);
  };

  const endpoint = section.dataset.liveEndpoint;
  if (endpoint) {
    const poll = async () => {
      try {
        const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        Object.entries(data).forEach(([key, value]) => applyLive(key, Number(value)));
        updatedAt = data.updated ? new Date(data.updated) : new Date();
        renderUpdated();
      } catch {
        /* Network hiccup: keep the last known values. */
      }
    };
    poll();
    setInterval(poll, POLL_INTERVAL);
  } else if ('liveDemo' in section.dataset) {
    const publications = counters.find((c) => c.el.dataset.liveKey === 'publications');
    const schedule = () =>
      setTimeout(() => {
        if (publications && !document.hidden) {
          applyLive('publications', publications.value + 1);
          updatedAt = new Date();
          renderUpdated();
        }
        schedule();
      }, 14_000 + Math.random() * 16_000);
    schedule();
  }

  renderUpdated();
  setInterval(renderUpdated, 30_000);
}
