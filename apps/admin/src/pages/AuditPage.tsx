import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@fsbm/shared';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { EmptyState, PageHeader, Spinner } from '../components/ui';

export function AuditPage() {
  const { data, isPending } = useQuery({ queryKey: ['audit'], queryFn: () => api.get<AuditEntry[]>('/audit?limit=300') });
  return (
    <>
      <PageHeader title="Journal d’audit" description="Toutes les actions effectuées dans le back-office : connexions, créations, validations, publications, retraits. Ce journal ne peut pas être modifié." />
      {isPending && <Spinner />}
      {data && (
        <div className="card overflow-x-auto">
          {data.length === 0 && <EmptyState>Aucune entrée.</EmptyState>}
          <table className="w-full text-left">
            <thead className="table-head">
              <tr>
                <th scope="col" className="px-4 py-2.5">Date</th>
                <th scope="col" className="px-4 py-2.5">Utilisateur</th>
                <th scope="col" className="px-4 py-2.5">Action</th>
                <th scope="col" className="px-4 py-2.5">Détail</th>
                <th scope="col" className="px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(e.at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{e.user?.name ?? <span className="text-muted">Système</span>}</td>
                  <td className="px-4 py-2.5"><code className="rounded bg-canvas px-1.5 py-0.5 text-[0.75rem]">{e.action}</code></td>
                  <td className="px-4 py-2.5">{e.summary}</td>
                  <td className="px-4 py-2.5 text-[0.75rem] text-muted">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
