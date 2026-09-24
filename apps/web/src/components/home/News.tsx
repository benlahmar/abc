import { useState } from 'react';
import { motion } from 'motion/react';
import { NEWS_PAGE_SIZE, useNewsFeed } from '../../lib/queries';
import { cn } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';
import { Accent, SectionHeader } from '../ui/Section';
import { ErrorNote, Skeleton } from '../ui/States';
import { NewsRow } from '../news/NewsCards';


/** Actualités et annonces : filtres par catégorie, cartes horizontales, puis « Afficher plus ». */
export function News() {
  const [category, setCategory] = useState('all');
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData } = useNewsFeed(category);

  const first = data?.pages[0];
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const labels = Object.fromEntries((first?.categories ?? []).map((c) => [c.id, c.label]));
  const counts = first?.counts ?? {};
  const tabs = [{ id: 'all', label: 'Toutes' }, ...(first?.categories ?? []).filter((c) => counts[c.id])];
  const labelOf = (id: string) => labels[id] ?? id;

  const total = first?.total ?? 0;

  return (
    <section id="actualites" aria-labelledby="news-title" className="bg-paper py-28 lg:py-36">
      <div className="container-x">
        <SectionHeader
          index="05"
          eyebrow="Actualités"
          titleId="news-title"
          title={
            <>
              Actualités <Accent>et annonces</Accent>.
            </>
          }
          intro="Inscriptions, résultats, examens et vie de la Faculté : toutes les informations officielles publiées par la FSBM."
          action={<ArrowLink href="/actualites">Toutes les actualités</ArrowLink>}
        />

        <div className="mt-16 flex flex-col gap-4 border-b border-midnight/10 sm:flex-row sm:items-end sm:justify-between">
          <div role="group" aria-label="Filtrer les actualités par catégorie" className="-mb-px flex flex-wrap gap-x-8">
            {tabs.map((tab) => {
              const selected = tab.id === category;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(tab.id)}
                  className={cn('relative cursor-pointer py-4 text-[0.875rem] font-medium transition-colors', selected ? 'text-midnight' : 'text-muted hover:text-midnight')}
                >
                  {tab.label}
                  <sup className="ml-1 text-[0.625rem] text-muted">{counts[tab.id] ?? 0}</sup>
                  {selected && <motion.span layoutId="news-tab" className="absolute inset-x-0 bottom-0 h-[2px] bg-gold" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
                </button>
              );
            })}
          </div>
          <p className="pb-4 text-[0.75rem] text-muted" aria-live="polite">
            {first ? `${total} actualité${total > 1 ? 's' : ''}${category === 'all' ? '' : ` · ${labelOf(category)}`}` : ''}
          </p>
        </div>

        {isPending && (
          <div className="grid gap-6 pt-12 lg:grid-cols-2">
            <Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" />
          </div>
        )}
        {isError && <ErrorNote className="mt-14" onRetry={() => refetch()} />}
        {data && items.length === 0 && <p className="py-20 text-center text-muted">Aucune actualité publiée dans cette catégorie pour le moment.</p>}

        {items.length > 0 && (
          <div className={cn('grid gap-6 pt-12 lg:grid-cols-2', isPlaceholderData && 'opacity-50 transition-opacity')}>
            {items.map((item, i) => (
              <Reveal key={item.id} delay={(i % 2) * 0.08}>
                <NewsRow item={item} category={labelOf(item.category)} />
              </Reveal>
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="mt-16 flex justify-center">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="group inline-flex cursor-pointer items-center gap-3 border border-midnight/25 px-7 py-3.5 text-[0.8125rem] font-medium transition-colors duration-500 hover:border-midnight hover:bg-midnight hover:text-paper disabled:opacity-60"
            >
              {isFetchingNextPage ? 'Chargement…' : `Afficher ${NEWS_PAGE_SIZE} actualités de plus`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
