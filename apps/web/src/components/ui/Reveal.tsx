import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'li' | 'article' | 'section' | 'header' | 'figure';
}

/** Apparition douce à l'entrée dans la fenêtre (désactivée si l'utilisateur limite les animations). */
export function Reveal({ children, className, delay = 0, y = 28, as = 'div' }: RevealProps) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      {children}
    </Component>
  );
}

/** Ligne de titre qui monte depuis un masque (effet « rideau »). */
export function MaskLine({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={`block overflow-hidden pb-[0.08em] ${className ?? ''}`}>
      <motion.span
        className="block"
        initial={reduced ? false : { y: '105%' }}
        animate={{ y: 0 }}
        transition={{ duration: 1.2, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}
