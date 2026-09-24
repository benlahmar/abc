import type { NewsItem } from '@fsbm/shared';
import { dateParts, formatDate, langProps } from '../../lib/format';
import { ArrowLink } from '../ui/Button';
import { SmartLink } from '../ui/SmartLink';
import { Visual, variantFor } from '../ui/Visual';
import { Attachments } from './Attachments';

const newsHref = (item: NewsItem) => (item.url && item.url !== '#' ? item.url : `/actualites/${item.id}`);

function Meta({ item, category }: { item: NewsItem; category: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
      <span className="eyebrow text-bronze">{category}</span>
      <span aria-hidden="true" className="h-px w-5 bg-midnight/20" />
      <time dateTime={item.date} className="text-muted">
        {formatDate(item.date)}
      </time>
    </p>
  );
}

function Cover({ item, category, large }: { item: NewsItem; category: string; large?: boolean }) {
  return (
    <SmartLink href={newsHref(item)} tabIndex={-1} aria-hidden="true" className="on-dark relative block overflow-hidden bg-midnight text-paper">
      <div className={large ? 'aspect-[16/10]' : 'aspect-[16/10]'}>
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.04]" />
        ) : (
          <>
            <Visual variant={variantFor(item.category)} className="transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.04]" />
            <span className="absolute bottom-6 left-7 font-serif text-[clamp(2.5rem,6vw,5rem)] leading-none text-paper/90 italic">{category}</span>
            <span className="absolute top-6 right-7 font-mono text-[0.625rem] tracking-widest text-paper/60 uppercase">FSBM</span>
          </>
        )}
      </div>
      {large && <span className="eyebrow absolute top-6 left-7 bg-paper px-3 py-1.5 text-midnight">À la une</span>}
      <span className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-700 ease-out-expo group-hover:scale-x-100" />
    </SmartLink>
  );
}

export function FeaturedNews({ item, category }: { item: NewsItem; category: string }) {
  return (
    <article className="group">
      <Cover item={item} category={category} large />
      <div className="mt-8">
        <Meta item={item} category={category} />
      </div>
      <h3 className="display mt-5 text-[clamp(1.9rem,3vw,2.75rem)] leading-[1.06]" {...langProps(item.title)}>
        <SmartLink href={newsHref(item)} className="link-draw">
          {item.title}
        </SmartLink>
      </h3>
      {item.excerpt && (
        <p className="mt-5 max-w-2xl text-[1rem] leading-relaxed text-muted" {...langProps(item.excerpt)}>
          {item.excerpt}
        </p>
      )}
      <Attachments items={item.attachments} context={item.title} />
      <ArrowLink href={newsHref(item)} className="mt-7">
        Lire la suite<span className="sr-only"> : {item.title}</span>
      </ArrowLink>
    </article>
  );
}

export function NewsBrief({ item, category }: { item: NewsItem; category: string }) {
  const { day, month, year } = dateParts(item.date);
  return (
    <article className="grid grid-cols-[4.25rem_1fr] gap-6 border-b border-midnight/10 py-8 first:pt-0">
      <time dateTime={item.date} className="flex flex-col items-start border-r border-midnight/10 pr-5">
        <span className="figure text-[2.6rem] leading-none text-midnight">{day}</span>
        <span className="eyebrow mt-2 text-bronze">{month}</span>
        <span className="mt-1 text-[0.6875rem] text-muted">{year}</span>
      </time>
      <div className="min-w-0">
        <p className="eyebrow text-bronze">{category}</p>
        <h3 className="mt-3 font-serif text-[1.45rem] leading-[1.17]" {...langProps(item.title)}>
          <SmartLink href={newsHref(item)} className="link-draw">
            {item.title}
          </SmartLink>
        </h3>
        {item.excerpt && (
          <p className="mt-2.5 line-clamp-2 text-[0.875rem] leading-relaxed text-muted" {...langProps(item.excerpt)}>
            {item.excerpt}
          </p>
        )}
        <Attachments items={item.attachments} context={item.title} compact />
      </div>
    </article>
  );
}

export function NewsCard({ item, category }: { item: NewsItem; category: string }) {
  return (
    <article className="group">
      <Cover item={item} category={category} />
      <div className="mt-6">
        <Meta item={item} category={category} />
      </div>
      <h3 className="mt-4 font-serif text-[1.55rem] leading-[1.15]" {...langProps(item.title)}>
        <SmartLink href={newsHref(item)} className="link-draw">
          {item.title}
        </SmartLink>
      </h3>
      <Attachments items={item.attachments} context={item.title} compact />
    </article>
  );
}

export { newsHref };
