import { useState } from 'react';
import type { Testimonial } from '@fsbm/shared';
import { useCollection } from '../../lib/queries';
import { langProps } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { Play } from '../ui/Icons';
import { Reveal } from '../ui/Reveal';
import { Accent, SectionHeader } from '../ui/Section';
import { ErrorNote, Skeleton } from '../ui/States';
import { Visual } from '../ui/Visual';

/** Lecteur « léger » : la vignette est une image ; l'iframe YouTube (nocookie) n'est chargée qu'au clic. */
function VideoCard({ video }: { video: Testimonial }) {
  const [playing, setPlaying] = useState(false);
  const playable = Boolean(video.videoId);

  return (
    <article className="group flex h-full flex-col border border-paper/10 bg-paper/[0.02] transition-colors duration-500 hover:border-paper/25">
      <div className="relative aspect-video overflow-hidden bg-midnight">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        ) : playable ? (
          <button type="button" onClick={() => setPlaying(true)} className="absolute inset-0 cursor-pointer">
            <img
              src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover opacity-75 transition duration-[1.2s] ease-out-expo group-hover:scale-[1.04] group-hover:opacity-100"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full bg-paper text-brand transition-transform duration-500 ease-out-expo group-hover:scale-110">
                <Play className="ml-0.5 size-5" />
              </span>
            </span>
            <span className="sr-only">Lire la vidéo : {video.title}</span>
          </button>
        ) : (
          <>
            <Visual variant="orbit" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-16 place-items-center rounded-full border border-paper/25 text-paper/50">
                <Play className="ml-0.5 size-5" />
              </span>
            </span>
            <span className="absolute bottom-4 left-5 font-mono text-[0.625rem] tracking-widest text-paper/55 uppercase">Vidéo bientôt disponible</span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col p-7">
        {video.author && <p className="eyebrow text-gold">{video.author}</p>}
        <h3 className="mt-4 font-serif text-[1.45rem] leading-snug" {...langProps(video.title)}>
          {video.title}
        </h3>
        {video.description && (
          <p className="mt-3 line-clamp-2 text-[0.875rem] leading-relaxed text-paper/55" {...langProps(video.description)}>
            {video.description}
          </p>
        )}
      </div>
    </article>
  );
}

export function Testimonials() {
  const { data, isPending, isError, refetch } = useCollection('testimonials');

  return (
    <section id="temoignages" aria-labelledby="testimonials-title" className="on-dark grain relative isolate overflow-hidden bg-midnight-950 py-28 text-paper lg:py-36">
      <div aria-hidden="true" className="absolute top-1/3 -left-60 -z-10 size-[40rem] rounded-full bg-midnight-700/50 blur-[130px]" />
      <div className="container-x">
        <SectionHeader
          tone="dark"
          index="08"
          eyebrow="Témoignages"
          titleId="testimonials-title"
          title={
            <>
              Ils parlent <Accent tone="dark">de nous</Accent>.
            </>
          }
          intro="Ce que les étudiants, les anciens élèves et les partenaires disent de notre institution, en vidéo."
          action={
            <ArrowLink href="/temoignages" tone="dark">
              Voir tous les témoignages
            </ArrowLink>
          }
        />
        <ul className="mt-16 grid gap-6 md:grid-cols-3">
          {isPending && Array.from({ length: 3 }, (_, i) => <li key={i}><Skeleton className="aspect-[4/3]" /></li>)}
          {isError && <li className="col-span-full"><ErrorNote onRetry={() => refetch()} /></li>}
          {data?.items.map((video, i) => (
            <Reveal as="li" key={video.id} delay={i * 0.1}>
              <VideoCard video={video} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
