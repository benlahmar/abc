import type { Stat } from '@fsbm/shared';
import { useCollection } from '../../lib/queries';
import { cn } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { Counter } from '../ui/Counter';
import { Reveal } from '../ui/Reveal';
import { Accent, SectionHeader } from '../ui/Section';
import { ErrorNote, Skeleton } from '../ui/States';

const Figure = ({ stat, className }: { stat: Stat; className?: string }) => (
  <p className={cn('figure leading-[0.82]', className)}>
    {stat.prefix && <span className="text-gold">{stat.prefix}</span>}
    <Counter value={stat.value} />
    {stat.suffix && <span className="text-gold">{stat.suffix}</span>}
  </p>
);

/** Chiffres clés sur fond nuit (stats.json). */
export function KeyFigures() {
  const { data, isPending, isError, refetch } = useCollection('stats');
  const items = data?.items ?? [];
  const featured = items.find((s) => s.featured) ?? items[0];
  const others = items.filter((s) => s !== featured);

  return (
    <section id="chiffres-cles" aria-labelledby="figures-title" className="on-dark grain relative isolate overflow-hidden bg-midnight py-28 text-paper lg:py-36">
      <div aria-hidden="true" className="absolute -top-60 -left-40 -z-10 size-[42rem] rounded-full bg-midnight-700/70 blur-[130px]" />
      <div aria-hidden="true" className="absolute -right-40 -bottom-60 -z-10 size-[36rem] rounded-full bg-gold/10 blur-[130px]" />

      <div className="container-x">
        <SectionHeader
          tone="dark"
          index="03"
          eyebrow={`Chiffres clés${data?.year ? ` ${data.year}` : ''}`}
          titleId="figures-title"
          title={
            <>
              Une faculté qui se <Accent tone="dark">mesure</Accent> en impact.
            </>
          }
          intro="Effectifs, recherche et partenariats : les indicateurs de la Faculté des Sciences Ben M’Sik."
          action={
            <ArrowLink href="/accueil/chiffres-cles" tone="dark">
              Tous les chiffres clés
            </ArrowLink>
          }
        />

        {isPending && <Skeleton className="mt-20 h-96" />}
        {isError && <ErrorNote className="mt-20" onRetry={() => refetch()} />}

        {featured && (
          <div className="mt-20 grid border-t border-paper/10 lg:grid-cols-12">
            <Reveal className="border-b border-paper/10 py-12 lg:col-span-5 lg:border-r lg:border-b-0 lg:py-16 lg:pr-14">
              <h3 className="eyebrow text-gold">{featured.label}</h3>
              <Figure stat={featured} className="mt-10 text-[clamp(4.25rem,8vw,8.25rem)]" />
              <p className="mt-8 max-w-xs text-[1rem] leading-relaxed text-paper/60">{featured.description}</p>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:col-span-7">
              {others.map((stat, i) => (
                <Reveal
                  key={stat.id}
                  delay={0.08 * (i + 1)}
                  className={cn(
                    'border-b border-paper/10 py-10 lg:py-14',
                    i % 2 === 0 ? 'sm:pr-10 lg:pl-14' : 'sm:border-l sm:pl-10',
                    i >= others.length - 2 && 'sm:border-b-0',
                  )}
                >
                  <h3 className="eyebrow text-paper/50">{stat.label}</h3>
                  <Figure stat={stat} className="mt-8 text-[clamp(3.5rem,5.5vw,5rem)]" />
                  <p className="mt-5 text-[0.9rem] text-paper/55">{stat.description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
