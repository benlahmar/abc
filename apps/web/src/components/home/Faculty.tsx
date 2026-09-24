import { useCollection } from '../../lib/queries';
import { initials } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';
import { Accent, SectionHeader } from '../ui/Section';
import { SmartLink } from '../ui/SmartLink';
import { ErrorNote, Skeleton } from '../ui/States';
import { Visual, variantFor } from '../ui/Visual';

/** Corps enseignant (faculty.json) : portraits en noir et blanc qui passent en couleur au survol. */
export function Faculty() {
  const { data, isPending, isError, refetch } = useCollection('faculty');

  return (
    <section id="enseignants" aria-labelledby="faculty-title" className="bg-paper py-28 lg:py-36">
      <div className="container-x">
        <SectionHeader
          index="07"
          eyebrow="Corps enseignant"
          titleId="faculty-title"
          title={
            <>
              Rencontrez notre <Accent>corps enseignant</Accent>.
            </>
          }
          intro="Nos professeurs apportent leur expertise et leur passion pour créer un environnement académique enrichissant."
          action={<ArrowLink href="/enseignants">Voir tous les professeurs</ArrowLink>}
        />

        <ul className="mt-16 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
          {isPending && Array.from({ length: 4 }, (_, i) => <li key={i}><Skeleton className="aspect-[3/4]" /></li>)}
          {isError && <li className="col-span-full"><ErrorNote onRetry={() => refetch()} /></li>}
          {data?.items.map((person, i) => (
            <Reveal as="li" key={person.id} delay={i * 0.08} className="group relative">
              <div className="on-dark relative aspect-[3/4] overflow-hidden bg-midnight text-paper">
                {person.photo ? (
                  <img
                    src={person.photo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover grayscale transition duration-[1.2s] ease-out-expo group-hover:scale-[1.04] group-hover:grayscale-0"
                  />
                ) : (
                  <div aria-hidden="true" className="absolute inset-0">
                    <Visual variant={variantFor('', i + 1)} />
                    <span className="absolute inset-0 grid place-items-center font-serif text-7xl text-paper/85">{initials(person.name)}</span>
                  </div>
                )}
                {person.department && (
                  <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-midnight-950/90 to-transparent p-5 pt-12 text-[0.8125rem] text-paper/85 transition-transform duration-700 ease-out-expo group-hover:translate-y-0">
                    {person.department}
                  </span>
                )}
              </div>
              <h3 className="mt-5 font-serif text-[1.45rem] leading-tight">
                <SmartLink href={person.url} className="link-draw after:absolute after:inset-0">
                  {person.name}
                </SmartLink>
              </h3>
              <p className="mt-1.5 text-[0.8125rem] text-muted">{person.title}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
