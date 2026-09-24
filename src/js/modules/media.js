import { prefersReducedMotion } from './motion.js';

/**
 * Hero media container: pause/play control (WCAG 2.2.2) and a running timecode.
 * Works with the generative placeholder scene or a real <video> loop.
 */
export function initMedia(figure) {
  if (!figure) return;

  const button = figure.querySelector('[data-media-toggle]');
  const label = figure.querySelector('[data-media-label]');
  const timecode = figure.querySelector('[data-timecode]');
  const video = figure.querySelector('video');
  const FPS = 24;

  let paused = false;
  let visible = true;
  let elapsed = 0;
  let last = performance.now();
  let frame = 0;

  const pad = (n) => String(n).padStart(2, '0');
  const render = () => {
    const totalFrames = Math.floor((elapsed / 1000) * FPS);
    const f = totalFrames % FPS;
    const s = Math.floor(totalFrames / FPS);
    timecode.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
  };

  const tick = (now) => {
    elapsed += now - last;
    last = now;
    render();
    frame = requestAnimationFrame(tick);
  };

  const sync = () => {
    cancelAnimationFrame(frame);
    if (!paused && visible && timecode) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  const setPaused = (value) => {
    paused = value;
    figure.toggleAttribute('data-paused', paused);
    button?.setAttribute('aria-pressed', String(paused));
    if (label) label.textContent = paused ? 'Lire l’animation' : 'Mettre en pause l’animation';
    button?.querySelector('[data-icon="pause"]')?.classList.toggle('hidden', paused);
    button?.querySelector('[data-icon="play"]')?.classList.toggle('hidden', !paused);
    if (video) paused ? video.pause() : video.play().catch(() => {});
    sync();
  };

  button?.addEventListener('click', () => setPaused(!paused));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }).observe(figure);
  }

  if (timecode) render();
  setPaused(prefersReducedMotion());
}
