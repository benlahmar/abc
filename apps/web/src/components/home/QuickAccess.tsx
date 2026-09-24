import { useCollection } from '../../lib/queries';
import { cn, pad2 } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { ArrowUpRight, serviceIcons } from '../ui/Icons';
import { Reveal } from '../ui/Reveal';
import { SmartLink } from '../ui/SmartLink';
import { ErrorNote, Skeleton } from '../ui/States';

/** Bande d'accès rapide aux services en ligne (services.json). */
export function QuickAccess() {
  const { data, isPending, isError, refetch } = useCollection('services');

  return (
    <section id="acces-rapide" aria-labelledby="quick-title" className="bg-paper">
      <div className="container-x py-16 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="quick-title" className="eyebrow flex items-center gap-4 text-muted">
            <span className="text-brand">Accès rapide</span>
            <span aria-hidden="true" className="h-px w-10 bg-gold" />
            Services en ligne
          </h2>
          <ArrowLink href="/services">Tous les services</ArrowLink>
        </div>

        <ul className="mt-10 grid border-t border-l border-midnight/10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {isPending && Array.from({ length: 6 }, (_, i) => <li key={i} className="border-r border-b border-midnight/10 p-7"><Skeleton className="h-36" /></li>)}
          {isError && <li className="col-span-full border-r border-b border-midnight/10 p-6"><ErrorNote onRetry={() => refetch()} /></li>}
          {data?.items.map((service, i) => {
            const Icon = serviceIcons[service.icon];
            return (
              <Reveal as="li" key={service.id} delay={i * 0.06} className="border-r border-b border-midnight/10">
                <SmartLink href={service.url} className="group relative flex h-full min-h-[14rem] flex-col overflow-hidden p-7">
                  <span aria-hidden="true" className="absolute inset-0 translate-y-full bg-midnight transition-transform duration-700 ease-out-expo group-hover:translate-y-0 group-focus-visible:translate-y-0" />
                  {service.highlight && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-gold" />}
                  <span className="relative flex items-start justify-between">
                    <Icon className="size-8 text-brand transition-colors duration-500 group-hover:text-gold" />
                    <span className="font-mono text-[0.6875rem] text-muted transition-colors duration-500 group-hover:text-paper/40" aria-hidden="true">
                      {pad2(i + 1)}
                    </span>
                  </span>
                  <span className="relative mt-auto pt-10">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-serif text-[1.5rem] leading-tight transition-colors duration-500 group-hover:text-paper">{service.title}</span>
                      <ArrowUpRight className={cn('size-4 shrink-0 text-brand transition duration-500 ease-out-expo group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold')} />
                    </span>
                    {service.description && (
                      <span className="mt-2 block text-[0.8125rem] leading-relaxed text-muted transition-colors duration-500 group-hover:text-paper/60">
                        {service.description}
                      </span>
                    )}
                  </span>
                </SmartLink>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
