import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { statusLabels, type AdminCategory, type AdminContentSummary, type ContentStatus } from '@fsbm/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/format';
import { ContentTable } from '../components/ContentTable';
import { IconPlus, IconSearch } from '../components/icons';
import { Alert, PageHeader, Spinner } from '../components/ui';

const tabs: Array<{ id: string; label: string }> = [
  { id: '', label: 'Tous' },
  ...(['draft', 'changes_requested', 'in_review', 'in_validation', 'scheduled', 'published', 'archived', 'withdrawn'] as ContentStatus[]).map((s) => ({ id: s, label: statusLabels[s] })),
  { id: 'trash', label: 'Corbeille' },
];

export function ContentsPage() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const category = params.get('categorie') ?? '';
  const q = params.get('q') ?? '';

  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (category) query.set('category', category);
  if (q) query.set('q', q);

  const { data, isPending, isError } = useQuery({ queryKey: ['contents', status, category, q], queryFn: () => api.get<AdminContentSummary[]>(`/contents?${query}`) });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<AdminCategory[]>('/categories') });

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Actualités"
        description="Tous les contenus des catégories dont vous faites partie."
        actions={
          hasRole('redacteur') && (
            <Link to="/actualites/nouvelle" className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-[0.8125rem] font-medium text-white hover:bg-brand-700">
              <IconPlus className="size-4" /> Nouvelle actualité
            </Link>
          )
        }
      />

      <div className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist" aria-label="Filtrer par statut">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              onClick={() => set('statut', tab.id)}
              className={cn('-mb-px cursor-pointer border-b-2 px-3 py-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors', status === tab.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-midnight')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-b border-line bg-canvas/40 px-4 py-3">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">Rechercher par titre</span>
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input type="search" defaultValue={q} placeholder="Rechercher par titre…" className="input pl-9" onChange={(e) => set('q', e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Catégorie</span>
            <select value={category} onChange={(e) => set('categorie', e.target.value)} className="input min-w-52">
              <option value="">Toutes les catégories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isPending && <Spinner />}
        {isError && <div className="p-4"><Alert>Liste indisponible.</Alert></div>}
        {data && <ContentTable items={data} empty="Aucun contenu ne correspond à ces critères." />}
      </div>
    </>
  );
}
