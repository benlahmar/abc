import { useCollection } from '../../lib/queries';
import { ButtonLink } from '../ui/Button';

/** Mosaïque pleine largeur des photos du campus (gallery.json), avec appel à découvrir la vie étudiante. */
export function CampusMosaic() {
  const { data } = useCollection('gallery');
  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <section aria-label="La FSBM en images" className="relative bg-midnight-950">
      <ul className="grid grid-cols-2 sm:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.id} className={`group relative h-52 overflow-hidden sm:h-72 lg:h-80 ${i === 0 && items.length === 3 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <img
              src={item.image}
              alt={item.alt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition duration-[1.6s] ease-out-expo group-hover:scale-[1.05]"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-midnight-950/25 transition-colors duration-700 group-hover:bg-midnight-950/5" />
            {item.caption && (
              <p className="on-dark absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-midnight-950/90 to-transparent p-5 pt-12 text-[0.875rem] text-paper opacity-0 transition duration-500 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100">
                {item.caption}
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <ButtonLink href="/etudiant" variant="light" className="pointer-events-auto shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)]">
          Découvrir la vie à la FSBM
        </ButtonLink>
      </div>
    </section>
  );
}
