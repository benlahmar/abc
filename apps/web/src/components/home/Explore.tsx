import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ExploreTab } from '@fsbm/shared';
import { useCollection, useLatestNews } from '../../lib/queries';
import { cn, formatDate, formatNumber, langProps } from '../../lib/format';
import { ArrowLink, ButtonLink } from '../ui/Button';
import { ArrowRight, Calendar, Document } from '../ui/Icons';
import { Reveal } from '../ui/Reveal';
import { Accent } from '../ui/Section';
import { SmartLink } from '../ui/SmartLink';
import { ErrorNote, Skeleton } from '../ui/States';
import { Visual } from '../ui/Visual';
import { newsHref } from '../news/NewsCards';

/** Carte « Pré-candidature » : chiffre clé + appel à l'action. */
function AdmissionCard() {
  const { data: stats } = useCollection('stats');
  const students = stats?.items.find((s) => s.featured) ?? stats?.items[0];
  return (
    <div className="relative overflow-hidden bg-brand p-8">
      <div aria-hidden="true" className="absolute -top-16 -right-16 size-48 rounded-full bg-brand-light/25 blur-2xl" />
      <p className="eyebrow relative text-paper/75">Rejoindre la FSBM</p>
      {students && (
        <p className="relative mt-6 flex items-baseline gap-3">
          <span className="figure text-[3.4rem] leading-none">
            {students.prefix}
            {formatNumber(students.value)}
          </span>
          <span className="text-[0.875rem] text-paper/75">{students.description}</span>
        </p>
      )}
      <ButtonLink href="/pre-candidature" variant="light" className="relative mt-8 w-full sm:w-auto">
        Pré-candidature en ligne
      </ButtonLink>
    </div>
  );
}

/** Avis officiels : dernières annonces accompagnées de documents à télécharger. */
function Notices() {
  const { data, isPending, isError } = useLatestNews(20);
  const notices = (data?.items ?? []).filter((item) => item.attachments.length > 0).slice(0, 3);
  const labelOf = (id: string) => data?.categories.find((c) => c.id === id)?.label ?? id;

  return (
    <section aria-labelledby="notices-title" className="bg-paper p-8 text-midnight">
      <h3 id="notices-title" className="flex items-center gap-3 font-serif text-[1.75rem] leading-none">
        <span aria-hidden="true" className="size-2 animate-pulse-soft rounded-full bg-gold" />
        Avis officiels
      </h3>
      {isPending && <Skeleton className="mt-6 h-48" />}
      {isError && <p className="mt-6 text-sm text-muted">Avis momentanément indisponibles.</p>}
      <ul className="mt-5">
        {notices.map((item) => (
          <li key={item.id} className="border-b border-midnight/10 py-5 last:border-b-0 last:pb-0">
            <p className="eyebrow text-brand">{labelOf(item.category)}</p>
            <h4 className="mt-2 line-clamp-2 text-[0.975rem] font-medium leading-snug" {...langProps(item.title)}>
              <SmartLink href={newsHref(item)} className="link-draw">
                {item.title}
              </SmartLink>
            </h4>
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.75rem] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                <time dateTime={item.date}>{formatDate(item.date)}</time>
              </span>
              <span className="inline-flex items-center gap-1.5 text-brand">
                <Document className="size-3.5" />
                {item.attachments.length} document{item.attachments.length > 1 ? 's' : ''}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <ArrowLink href="/actualites" className="mt-7">
        Tous les avis
      </ArrowLink>
    </section>
  );
}

function TabPanel({ tab, labelledBy, id }: { tab: ExploreTab; labelledBy: string; id: string }) {
  const reduced = useReducedMotion();
  const wideMore = tab.items.length % 2 === 0;
  return (
    <motion.div
      role="tabpanel"
      id={id}
      aria-labelledby={labelledBy}
      tabIndex={0}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="grid gap-5 focus:outline-none sm:grid-cols-2"
    >
      {tab.items.map((item, i) => (
        <SmartLink
          key={item.id}
          href={item.url}
          className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden border border-paper/10 bg-midnight-800"
        >
          {item.image ? (
            <img
              src={item.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.05]"
            />
          ) : (
            <Visual variant={item.visual ?? 'grid'} className="transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.05]" />
          )}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-midnight-950/95 via-midnight-950/35 to-transparent" />
          <span aria-hidden="true" className="absolute top-5 left-6 font-mono text-[0.6875rem] text-paper/55">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="relative p-6">
            <span className="flex items-center justify-between gap-4">
              <span className="font-serif text-[1.65rem] leading-tight">{item.title}</span>
              <ArrowRight className="size-4 shrink-0 -translate-x-2 text-brand-light opacity-0 transition duration-500 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
            </span>
            {item.description && <span className="mt-2 line-clamp-2 block text-[0.8125rem] leading-relaxed text-paper/65">{item.description}</span>}
          </span>
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
        </SmartLink>
      ))}
      {tab.more && (
        <SmartLink
          href={tab.more.url}
          className={cn(
            'group flex items-center justify-between gap-4 border border-paper/15 p-7 transition-colors duration-500 hover:border-paper/40 hover:bg-paper/[0.05]',
            wideMore ? 'sm:col-span-2' : 'aspect-[4/3] flex-col items-start justify-end',
          )}
        >
          <span className="font-serif text-[1.65rem] leading-tight">{tab.more.label}</span>
          <span aria-hidden="true" className="grid size-12 place-items-center bg-brand text-paper transition-transform duration-500 ease-out-expo group-hover:translate-x-1">
            <ArrowRight className="size-4" />
          </span>
        </SmartLink>
      )}
    </motion.div>
  );
}

/** « La FSBM de l'intérieur » : onglets (modèle WAI-ARIA Tabs), pré-candidature et avis officiels. */
export function Explore() {
  const { data, isPending, isError, refetch } = useCollection('explore');
  const [active, setActive] = useState(0);
  const uid = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = data?.tabs ?? [];
  const current = tabs[active];

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const index = next > last ? 0 : next < 0 ? last : next;
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  return (
    <section id="explorer" aria-labelledby="explore-title" className="bg-paper pb-4 lg:pb-8">
      <div className="on-dark grain relative isolate mx-3 overflow-hidden bg-midnight text-paper sm:mx-6 lg:mx-10">
        <div aria-hidden="true" className="absolute -top-40 -left-40 -z-10 size-[36rem] rounded-full bg-brand/40 blur-[140px]" />
        <div className="container-x py-20 lg:py-28">
          <Reveal className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow flex items-center gap-4 text-paper/55">
                <span className="text-gold">02</span>
                <span aria-hidden="true" className="h-px w-10 bg-gold/60" />
                Explorer
              </p>
              <h2 id="explore-title" className="display mt-7 text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.98]">
                La FSBM <Accent tone="dark">de l’intérieur</Accent>.
              </h2>
            </div>
            {tabs.length > 0 && (
              <div role="tablist" aria-label="Explorer la Faculté" className="flex flex-wrap gap-x-8 border-b border-paper/15">
                {tabs.map((tab, i) => {
                  const selected = i === active;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`${uid}-tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls={selected ? `${uid}-panel-${tab.id}` : undefined}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setActive(i)}
                      onKeyDown={onKeyDown}
                      className={cn('relative -mb-px cursor-pointer py-4 font-serif text-[1.35rem] transition-colors', selected ? 'text-paper' : 'text-paper/55 hover:text-paper')}
                    >
                      {tab.label}
                      {selected && <motion.span layoutId={`${uid}-tab-line`} className="absolute inset-x-0 bottom-0 h-[2px] bg-gold" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </Reveal>

          <div className="mt-14 grid gap-8 lg:grid-cols-12">
            <Reveal className="flex flex-col gap-6 lg:col-span-4">
              <AdmissionCard />
              <Notices />
            </Reveal>
            <div className="lg:col-span-8">
              {isPending && <Skeleton className="h-[36rem]" />}
              {isError && <ErrorNote onRetry={() => refetch()} />}
              <AnimatePresence mode="wait" initial={false}>
                {current && <TabPanel key={current.id} tab={current} id={`${uid}-panel-${current.id}`} labelledBy={`${uid}-tab-${current.id}`} />}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
