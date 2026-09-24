import { useCollection } from '../../lib/queries';
import { cn } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';
import { Accent, SectionHeader } from '../ui/Section';
import { ErrorNote, Skeleton } from '../ui/States';

/** Grille asymétrique : la première photo occupe deux rangées, les suivantes s'empilent à droite. */
const layout = ['lg:col-span-7 lg:row-span-2 aspect-[4/3] lg:aspect-auto', 'lg:col-span-5 aspect-[16/10]', 'lg:col-span-5 aspect-[16/10]'];

/** Vie à la FSBM : photos réelles du campus (gallery.json). */
export function Campus() {
  const { data, isPending, isError, refetch } = useCollection('gallery');
  const items = data?.items.slice(0, 3) ?? [];

  return (
    <section id="vie-campus" aria-labelledby="campus-title" className="bg-paper py-28 lg:py-36">
      <div className="container-x">
        <SectionHeader
          index="04"
          eyebrow="Vie à la FSBM"
          titleId="campus-title"
          title={
            <>
              Un campus qui <Accent>vit</Accent> la science.
            </>
          }
          intro="Conférences, journées portes ouvertes, rencontres scientifiques : la Faculté au quotidien, à Ben M’Sik."
          action={<ArrowLink href="/actualites">Suivre l’actualité du campus</ArrowLink>}
        />

        {isPending && <Skeleton className="mt-16 h-[34rem]" />}
        {isError && <ErrorNote className="mt-16" onRetry={() => refetch()} />}
        {items.length > 0 && (
          <div className="mt-16 grid gap-5 lg:grid-cols-12 lg:grid-rows-2">
            {items.map((item, i) => (
              <Reveal as="figure" key={item.id} delay={i * 0.1} className={cn('group relative overflow-hidden bg-midnight', layout[i])}>
                <img
                  src={item.image}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.04]"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-midnight-950/85 via-midnight-950/10 to-transparent" />
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
                {(item.kicker || item.caption) && (
                  <figcaption className="on-dark absolute inset-x-0 bottom-0 p-6 text-paper sm:p-8">
                    {item.kicker && <p className="eyebrow text-gold">{item.kicker}</p>}
                    {item.caption && <p className={cn('mt-3 font-serif leading-tight', i === 0 ? 'text-[clamp(1.6rem,2.6vw,2.4rem)]' : 'text-[1.5rem]')}>{item.caption}</p>}
                  </figcaption>
                )}
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
