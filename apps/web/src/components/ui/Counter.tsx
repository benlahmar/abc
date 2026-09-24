import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { formatNumber } from '../../lib/format';

/** Compteur animé jusqu'à `value` ; les lecteurs d'écran lisent directement la valeur finale. */
export function Counter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduced = useReducedMotion();
  const current = useMotionValue(reduced ? value : 0);
  const text = useTransform(current, (latest) => formatNumber(latest, decimals));

  useEffect(() => {
    if (reduced) {
      current.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(current, value, { duration: 2.2, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, reduced, value, current]);

  return (
    <>
      <motion.span ref={ref} aria-hidden="true">
        {text}
      </motion.span>
      <span className="sr-only">{formatNumber(value, decimals)}</span>
    </>
  );
}
