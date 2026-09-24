import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCollection } from '../../lib/queries';
import { cn, pad2 } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { ArrowRight } from '../ui/Icons';
import { Reveal } from '../ui/Reveal';
import { Accent } from '../ui/Section';
import { SmartLink } from '../ui/SmartLink';
import { ErrorNote, Skeleton } from '../ui/States';
import { Visual, variantFor } from '../ui/Visual';

/**
 * Offre de formation : grande liste typographique à droite, aperçu fixe à gauche
 * qui suit la ligne survolée ou focalisée.
 */
export function Programmes() {
  const { data, isPending, isError, refetch } = useCollection('programmes');
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const items = data?.items ?? [];
  const current = items[active];

  return (
    <section id="formation" aria-labelledby="programmes-title" className="border-t border-midnight/10 bg-paper py-28 lg:py-36">
      <div className="container-x grid gap-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5 lg:pr-10">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <p className="eyebrow flex items-center gap-4 text-muted">
                <span className="text-brand">03</span>
                <span aria-hidden="true" className="h-px w-10 bg-gold" />
                Formation
              </p>
              <h2 id="programmes-title" className="display mt-7 text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.98]">
                Nos programmes, <Accent>de la Licence au Doctorat</Accent>.
              </h2>
              <p className="mt-7 max-w-md text-[0.975rem] leading-relaxed text-muted">
                Découvrez notre gamme complète de formations adaptées à tous les niveaux et à tous les profils.
              </p>
              <ArrowLink href="/formation" className="mt-7">
                Explorer tous nos programmes
              </ArrowLink>
            </Reveal>

            <div aria-hidden="true" className="on-dark relative mt-14 hidden aspect-[5/4] overflow-hidden bg-midnight text-paper lg:block">
              <AnimatePresence initial={false}>
                {current && (
                  <motion.div
                    key={current.id}
                    className="absolute inset-0"
                    initial={reduced ? false : { opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Visual variant={variantFor('', active)} />
                    <div className="absolute inset-0 flex flex-col justify-between p-9">
                      <p className="eyebrow text-gold">{current.title}</p>
                      <div>
                        {current.count !== null ? (
                          <p className="flex items-baseline gap-4">
                            <span className="figure text-[7.5rem] leading-[0.8]">{current.count}</span>
                            <span className="font-serif text-2xl text-paper/80 italic">formations</span>
                          </p>
                        ) : (
                          <p className="figure text-[7.5rem] leading-[0.8] text-paper/90">{pad2(active + 1)}</p>
                        )}
                        <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-paper/70">{current.description}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <ol className="lg:col-span-7" aria-labelledby="programmes-title">
          {isPending && Array.from({ length: 6 }, (_, i) => <li key={i} className="border-b border-midnight/10 py-9"><Skeleton className="h-12 w-2/3" /></li>)}
          {isError && <li><ErrorNote onRetry={() => refetch()} /></li>}
          {items.map((p, i) => (
            <Reveal as="li" key={p.id} delay={i * 0.05}>
              <SmartLink
                href={p.url}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className={cn('group relative grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-5 border-b border-midnight/10 py-8 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-x-6 lg:py-9', i === 0 && 'border-t')}
              >
                <span aria-hidden="true" className={cn('absolute bottom-[-1px] left-0 h-px w-full origin-left bg-gold transition-transform duration-700 ease-out-expo', active === i ? 'scale-x-100' : 'scale-x-0')} />
                <span className="font-mono text-[0.75rem] text-muted" aria-hidden="true">{pad2(i + 1)}</span>
                <span>
                  <span className={cn('display block text-[clamp(1.9rem,3.6vw,3.35rem)] leading-none transition-[color,translate] duration-500 ease-out-expo', active === i && 'text-brand lg:translate-x-2')}>
                    {p.title}
                  </span>
                  <span className="mt-3 block max-w-lg text-[0.875rem] leading-relaxed text-muted lg:hidden">{p.description}</span>
                </span>
                <span className="flex items-center gap-5">
                  {p.count !== null && (
                    <span className="hidden text-[0.75rem] font-medium whitespace-nowrap text-muted sm:block">
                      <span className="figure text-[1.35rem] text-midnight">{p.count}</span> formations
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-11 place-items-center border transition-colors duration-500',
                      active === i ? 'border-midnight bg-midnight text-gold' : 'border-midnight/15 text-midnight',
                    )}
                  >
                    <ArrowRight className="size-4 transition-transform duration-500 ease-out-expo group-hover:translate-x-0.5" />
                  </span>
                </span>
              </SmartLink>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
