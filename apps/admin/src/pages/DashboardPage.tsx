import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { roleLabels, statusLabels, type AdminDashboard, type ContentStatus } from '@fsbm/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ContentTable } from '../components/ContentTable';
import { IconPlus } from '../components/icons';
import { Alert, PageHeader, Spinner } from '../components/ui';

const counters: ContentStatus[] = ['draft', 'in_review', 'in_validation', 'scheduled', 'published'];

export function DashboardPage() {
  const { me, hasRole } = useAuth();
  const { data, isPending, isError } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<AdminDashboard>('/dashboard') });

  const roles = [...new Set(me.memberships.map((m) => `${roleLabels[m.role]} — ${m.categoryName}`))];

  return (
    <>
      <PageHeader
        title={`Bonjour, ${me.name}`}
        description={roles.length ? roles.join(' · ') : me.isAdmin ? 'Administrateur du portail' : 'Aucun rôle ne vous est encore attribué.'}
        actions={
          hasRole('redacteur') && (
            <Link to="/actualites/nouvelle" className="inline-flex items-center gap-2 rounded-md bg-brand px-3.5 py-2 text-[0.8125rem] font-medium text-white hover:bg-brand-700">
              <IconPlus className="size-4" /> Nouvelle actualité
            </Link>
          )
        }
      />
      {isPending && <Spinner />}
      {isError && <Alert>Tableau de bord indisponible.</Alert>}
      {data && (
        <div className="space-y-8">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Contenus par statut">
            {counters.map((status) => (
              <li key={status}>
                <Link to={`/actualites?statut=${status}`} className="card block p-4 transition-colors hover:border-brand/40">
                  <p className="text-[0.75rem] text-muted">{statusLabels[status]}</p>
                  <p className="mt-1 text-[1.6rem] font-light tabular-nums">{data.counts[status] ?? 0}</p>
                </Link>
              </li>
            ))}
          </ul>

          <section className="card overflow-hidden" aria-labelledby="pending-title">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="pending-title" className="text-[1rem] font-semibold">
                En attente de mon action
                {data.pending.length > 0 && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[0.75rem] text-midnight">{data.pending.length}</span>}
              </h2>
            </div>
            <ContentTable items={data.pending} empty="Rien à traiter pour le moment." compact />
          </section>

          <div className="grid gap-8 xl:grid-cols-2">
            <section className="card overflow-hidden" aria-labelledby="mine-title">
              <h2 id="mine-title" className="border-b border-line px-5 py-4 text-[1rem] font-semibold">Mes brouillons</h2>
              <ContentTable items={data.mine} empty="Aucun brouillon." compact />
            </section>
            <section className="card overflow-hidden" aria-labelledby="scheduled-title">
              <h2 id="scheduled-title" className="border-b border-line px-5 py-4 text-[1rem] font-semibold">Publications programmées</h2>
              <ContentTable items={data.scheduled} empty="Aucune publication programmée." compact />
            </section>
          </div>

          <section className="card overflow-hidden" aria-labelledby="recent-title">
            <h2 id="recent-title" className="border-b border-line px-5 py-4 text-[1rem] font-semibold">Publiées récemment</h2>
            <ContentTable items={data.recent} empty="Aucune publication." compact />
          </section>
        </div>
      )}
    </>
  );
}
