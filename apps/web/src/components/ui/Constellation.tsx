import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  gold: boolean;
}

const LINK = 150;
const POINTER_LINK = 210;
const PAPER = '248, 250, 252';
const GOLD = '197, 160, 89';

/**
 * Réseau de particules (évoque molécules, réseaux neuronaux, constellations).
 * S'anime uniquement quand il est visible ; image fixe si l'utilisateur limite les animations.
 */
export function Constellation({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let visible = true;
    const pointer = { x: -1e4, y: -1e4 };

    const seed = () => {
      const count = Math.min(150, Math.round((width * height) / 10500));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.3 + 0.5,
        gold: Math.random() < 0.13,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const alpha = (1 - Math.sqrt(d2) / LINK) * 0.2;
            ctx.strokeStyle = `rgba(${a.gold && b.gold ? GOLD : PAPER}, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const pdx = a.x - pointer.x;
        const pdy = a.y - pointer.y;
        const pd = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pd < POINTER_LINK) {
          ctx.strokeStyle = `rgba(${GOLD}, ${(1 - pd / POINTER_LINK) * 0.55})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
      for (const p of particles) {
        ctx.fillStyle = p.gold ? `rgba(${GOLD}, 0.95)` : `rgba(${PAPER}, 0.55)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.gold ? p.r + 0.9 : p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.gold) {
          ctx.fillStyle = `rgba(${GOLD}, 0.12)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }
      draw();
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (!reduced && visible && !document.hidden) frame = requestAnimationFrame(step);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw();
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      if (reduced) draw();
    };
    const onLeave = () => {
      pointer.x = pointer.y = -1e4;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      start();
    });
    intersection.observe(canvas);
    document.addEventListener('visibilitychange', start);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    resize();
    start();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', start);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
