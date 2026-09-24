import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCollection } from '../../lib/queries';
import { initials, langProps } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { Plus } from '../ui/Icons';
import { Reveal } from '../ui/Reveal';
import { ErrorNote, Skeleton } from '../ui/States';
import { Visual } from '../ui/Visual';

/** Mot du Doyen (dean.json) : portrait encadré, citation, message dépliable. */
export function Dean() {
  const { data: dean, isPending, isError, refetch } = useCollection('dean');
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  const moreId = useId();

  const [lead, ...more] = dean?.message ?? [];

  return (
    <section id="mot-du-doyen" aria-labelledby="dean-title" className="relative overflow-hidden bg-ivory py-28 lg:py-36">
      <div aria-hidden="true" className="absolute top-0 right-0 font-serif text-[28rem] leading-[0.7] text-gold/[0.08] select-none">“</div>
      <div className="container-x relative">
        {isPending && <Skeleton className="h-[34rem]" />}
        {isError && <ErrorNote onRetry={() => refetch()} />}
        {dean && (
          <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
            <Reveal as="figure" className="relative mx-auto w-full max-w-md lg:col-span-5 lg:mx-0 lg:max-w-none lg:pr-10">
              <div className="relative">
                <span aria-hidden="true" className="absolute top-5 -right-5 -bottom-5 left-5 border border-gold/60" />
                <div className="on-dark relative aspect-[4/5] overflow-hidden bg-midnight">
                  {dean.photo ? (
                    <img src={dean.photo} alt={`Portrait de ${dean.name}`} loading="lazy" decoding="async" className="size-full object-cover object-top" />
                  ) : (
                    <div role="img" aria-label={`Portrait de ${dean.name} (photo à venir)`} className="absolute inset-0">
                      <Visual variant="orbit" />
                      <span className="absolute inset-0 grid place-items-center font-serif text-[9rem] leading-none text-gold/90">{initials(dean.name)}</span>
                    </div>
                  )}
                </div>
              </div>
              <figcaption className="relative -mt-14 ml-auto w-fit max-w-[85%] bg-paper px-7 py-6 shadow-[0_30px_60px_-30px_rgb(10_25_47/0.45)] sm:-mr-6">
                <p className="font-serif text-[1.6rem] leading-none">{dean.name}</p>
                <p className="eyebrow mt-3 text-bronze">{dean.title}</p>
              </figcaption>
            </Reveal>

            <Reveal delay={0.1} className="lg:col-span-7 lg:pl-6">
              <h2 id="dean-title" className="eyebrow flex items-center gap-4 text-muted">
                <span className="text-bronze">06</span>
                <span aria-hidden="true" className="h-px w-10 bg-gold" />
                Mot du Doyen
              </h2>
              {dean.quote && (
                <blockquote className="display mt-10 text-[clamp(2.1rem,3.8vw,3.6rem)] leading-[1.08]" {...langProps(dean.quote)}>
                  <span aria-hidden="true" className="mr-1 text-gold">«&nbsp;</span>
                  {dean.quote}
                  <span aria-hidden="true" className="text-gold">&nbsp;»</span>
                </blockquote>
              )}
              <div className="mt-10 max-w-2xl border-t border-midnight/10 pt-8 text-[1.02rem] leading-[1.85] text-muted">
                {lead && <p {...langProps(lead)}>{lead}</p>}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={moreId}
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      {more.map((p) => (
                        <p key={p} className="mt-5" {...langProps(p)}>
                          {p}
                        </p>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-8">
                {more.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={moreId}
                    onClick={() => setExpanded((e) => !e)}
                    className="group inline-flex cursor-pointer items-center gap-3 border border-midnight/25 px-6 py-3 text-[0.8125rem] font-medium transition-colors duration-500 hover:border-midnight hover:bg-midnight hover:text-paper"
                  >
                    {expanded ? 'Réduire le message' : 'Lire la suite du message'}
                    <Plus className={`size-3.5 transition-transform duration-500 ${expanded ? 'rotate-45' : ''}`} />
                  </button>
                )}
                <ArrowLink href={dean.url}>Page du Doyen</ArrowLink>
              </div>
            </Reveal>
          </div>
        )}
      </div>
    </section>
  );
}
