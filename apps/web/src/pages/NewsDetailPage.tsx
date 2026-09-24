import { Link, useParams } from 'react-router';
import { ApiError } from '../lib/api';
import { useDocumentTitle } from '../lib/hooks';
import { useLatestNews, useNewsItem } from '../lib/queries';
import { formatDate, langProps } from '../lib/format';
import { ArrowLeft, Download } from '../components/ui/Icons';
import { Reveal } from '../components/ui/Reveal';
import { SmartLink } from '../components/ui/SmartLink';
import { ErrorNote, Skeleton } from '../components/ui/States';
import { NewsCard } from '../components/news/NewsCards';
import { ComingSoonPage } from './ComingSoonPage';

export function NewsDetailPage() {
  const { id = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useNewsItem(id);
  const latest = useLatestNews(4);
  useDocumentTitle(data?.item.title);

  if (isError && error instanceof ApiError && error.status === 404) {
    return <ComingSoonPage title="Actualité introuvable" message="Cette actualité n’existe pas ou a été retirée." />;
  }

  const item = data?.item;
  const category = data?.category?.label ?? item?.category ?? '';
  const others = (latest.data?.items ?? []).filter((n) => n.id !== id).slice(0, 3);
  const labelOf = (cat: string) => latest.data?.categories.find((c) => c.id === cat)?.label ?? cat;

  return (
    <>
      <section className="on-dark bg-midnight-950 pt-44 pb-20 text-paper lg:pt-52 lg:pb-24">
        <div className="container-x max-w-5xl">
          <nav aria-label="Fil d’Ariane" className="text-[0.75rem] text-paper/55">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link to="/" className="link-draw hover:text-paper">Accueil</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link to="/#actualites" className="link-draw hover:text-paper">Actualités</Link></li>
              {item && (
                <>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="line-clamp-1 max-w-[18rem] text-paper/80">{item.title}</li>
                </>
              )}
            </ol>
          </nav>
          {isPending && <Skeleton className="mt-10 h-40" />}
          {isError && <ErrorNote className="mt-10" onRetry={() => refetch()} />}
          {item && (
            <Reveal>
              <p className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem]">
                <span className="eyebrow text-gold">{category}</span>
                <span aria-hidden="true" className="h-px w-6 bg-paper/25" />
                <time dateTime={item.date} className="text-paper/60">{formatDate(item.date)}</time>
              </p>
              <h1 className="display mt-6 text-[clamp(2.4rem,5vw,4.5rem)] leading-[1.02]" {...langProps(item.title)}>
                {item.title}
              </h1>
              {item.excerpt && (
                <p className="mt-8 max-w-3xl text-[1.15rem] leading-relaxed text-paper/70" {...langProps(item.excerpt)}>
                  {item.excerpt}
                </p>
              )}
            </Reveal>
          )}
        </div>
      </section>

      {item && (
        <section className="bg-paper py-20 lg:py-24">
          <div className="container-x grid max-w-5xl gap-14 lg:grid-cols-12">
            <div className="text-[1.05rem] leading-[1.85] text-midnight/85 lg:col-span-7">
              {item.body.length > 0 ? (
                item.body.map((p) => (
                  <p key={p} className="mb-6" {...langProps(p)}>{p}</p>
                ))
              ) : (
                <p className="text-muted">Les documents officiels liés à cette annonce sont disponibles au téléchargement.</p>
              )}
              <Link to="/#actualites" className="group mt-8 inline-flex items-center gap-2.5 text-[0.875rem] font-medium">
                <ArrowLeft className="size-3.5 text-brand transition-transform duration-500 group-hover:-translate-x-1" />
                <span className="link-draw">Retour aux actualités</span>
              </Link>
            </div>
            {item.attachments.length > 0 && (
              <aside className="lg:col-span-5" aria-labelledby="docs-title">
                <h2 id="docs-title" className="eyebrow flex items-center gap-4 text-muted">
                  <span aria-hidden="true" className="h-px w-8 bg-gold" />
                  Documents ({item.attachments.length})
                </h2>
                <ul className="mt-6 grid grid-cols-2 border-t border-l border-midnight/10">
                  {item.attachments.map((doc, i) => (
                    <li key={`${doc.url}-${i}`} className="border-r border-b border-midnight/10">
                      <SmartLink href={doc.url} className="group flex items-center gap-3 p-4 text-[0.875rem] transition-colors hover:bg-midnight hover:text-paper">
                        <Download className="size-4 text-brand group-hover:text-gold" />
                        {doc.label}
                        <span className="sr-only"> — {item.title}</span>
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="more-news" className="border-t border-midnight/10 bg-paper py-20 lg:py-24">
          <div className="container-x">
            <h2 id="more-news" className="display text-[clamp(2rem,3.5vw,3rem)]">Autres actualités</h2>
            <div className="mt-12 grid gap-x-10 gap-y-14 md:grid-cols-3">
              {others.map((n) => (
                <NewsCard key={n.id} item={n} category={labelOf(n.category)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
