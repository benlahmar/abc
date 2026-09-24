import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCollection } from '../../lib/queries';
import { cn, langProps, pad2 } from '../../lib/format';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from '../ui/Icons';
import { SmartLink } from '../ui/SmartLink';
import { Skeleton } from '../ui/States';

const DURATION_S = 8;

/**
 * Carrousel « À la une » : défilement automatique (8 s) suspendu au survol / focus,
 * bouton pause (WCAG 2.2.2), jamais automatique si l'utilisateur limite les animations.
 */
export function Announcements() {
  const { data, isPending } = useCollection('hero');
  const slides = data?.slides ?? [];
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);

  if (isPending) return <Skeleton className="h-[22rem] border border-paper/10" />;
  if (!slides.length) return null;

  const count = slides.length;
  const current = slides[Math.min(index, count - 1)]!;
  const autoplay = !reduced && !paused && count > 1;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Annonces à la une"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHold(false)}
      className="relative overflow-hidden border border-paper/[0.12] bg-paper/[0.045] p-7 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)] backdrop-blur-xl sm:p-8"
    >
      <div aria-hidden="true" className="absolute -top-20 -right-20 size-48 rounded-full bg-gold/20 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4">
        <p className="eyebrow flex items-center gap-2.5 text-gold">
          <span aria-hidden="true" className="size-1.5 animate-pulse-soft rounded-full bg-gold" />À la une
        </p>
        <div className="flex items-center gap-1.5">
          <p className="mr-2 font-mono text-[0.6875rem] text-paper/50 tabular-nums" aria-hidden="true">
            {pad2(index + 1)} / {pad2(count)}
          </p>
          {count > 1 && (
            <>
              <IconButton label={autoplay ? 'Suspendre le défilement' : 'Reprendre le défilement'} onClick={() => setPaused((p) => !p)} hidden={Boolean(reduced)}>
                {autoplay ? <Pause className="size-3" /> : <Play className="size-3" />}
              </IconButton>
              <IconButton label="Annonce précédente" onClick={() => go(-1)}>
                <ChevronLeft className="size-3.5" />
              </IconButton>
              <IconButton label="Annonce suivante" onClick={() => go(1)}>
                <ChevronRight className="size-3.5" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      <div className="relative mt-8 min-h-[15.5rem]" aria-live={autoplay ? 'off' : 'polite'}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={current.id}
            aria-roledescription="diapositive"
            aria-label={`${index + 1} sur ${count}`}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {current.kicker && <p className="eyebrow text-paper/50">{current.kicker}</p>}
            <h2 className="mt-4 line-clamp-4 font-serif text-[1.7rem] leading-[1.14]" {...langProps(current.title)}>
              <SmartLink href={current.url} className="link-draw">
                {current.title}
              </SmartLink>
            </h2>
            {current.subtitle && (
              <p className="mt-4 line-clamp-2 text-[0.875rem] leading-relaxed text-paper/60" {...langProps(current.subtitle)}>
                {current.subtitle}
              </p>
            )}
            <SmartLink href={current.url} className="group mt-6 inline-flex items-center gap-2.5 text-[0.8125rem] font-medium text-gold">
              {current.cta}
              <ArrowRight className="size-3.5 transition-transform duration-500 group-hover:translate-x-1" />
              <span className="sr-only"> : {current.title}</span>
            </SmartLink>
          </motion.article>
        </AnimatePresence>
      </div>

      {count > 1 && (
        <div className="relative mt-6 flex gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Afficher l’annonce ${i + 1}`}
              aria-current={i === index}
              className="group relative h-6 flex-1 cursor-pointer"
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-paper/20 transition-colors group-hover:bg-paper/40" />
              {i === index && (
                <span
                  key={`${slide.id}-${autoplay}`}
                  className={cn('absolute inset-x-0 top-1/2 h-px origin-left bg-gold', autoplay && 'animate-progress')}
                  style={autoplay ? { ['--duration' as string]: `${DURATION_S}s`, animationPlayState: hold ? 'paused' : 'running' } : undefined}
                  onAnimationEnd={() => autoplay && go(1)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function IconButton({ label, onClick, children, hidden }: { label: string; onClick: () => void; children: React.ReactNode; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 cursor-pointer place-items-center border border-paper/15 text-paper/80 transition-colors duration-300 hover:border-gold hover:text-gold"
    >
      {children}
    </button>
  );
}
