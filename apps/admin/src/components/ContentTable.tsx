import { Link } from 'react-router';
import type { AdminContentSummary } from '@fsbm/shared';
import { formatDateTime, relative } from '../lib/format';
import { EmptyState, StatusBadge } from './ui';

/** Liste de contenus (titre, catégorie, statut, auteur, date de publication). */
export function ContentTable({ items, empty = 'Aucun contenu.', compact = false }: { items: AdminContentSummary[]; empty?: string; compact?: boolean }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="table-head">
          <tr>
            <th scope="col" className="px-4 py-2.5">Titre</th>
            <th scope="col" className="px-4 py-2.5">Catégorie</th>
            <th scope="col" className="px-4 py-2.5">Statut</th>
            {!compact && <th scope="col" className="px-4 py-2.5">Auteur</th>}
            <th scope="col" className="px-4 py-2.5">Publication</th>
            {!compact && <th scope="col" className="px-4 py-2.5">Modifié</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.id} className="group hover:bg-canvas/70">
              <td className="max-w-md px-4 py-3">
                <Link to={`/actualites/${item.id}`} className="line-clamp-2 font-medium text-midnight group-hover:text-brand hover:underline">
                  {item.title}
                </Link>
                {item.revisionOf && <span className="mt-1 inline-block text-[0.75rem] text-amber-700">Révision d’un contenu publié</span>}
                {item.hasOpenRevision && <span className="mt-1 inline-block text-[0.75rem] text-muted">Révision en cours</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{item.category.name}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status} trashed={item.trashed} /></td>
              {!compact && <td className="px-4 py-3 whitespace-nowrap text-muted">{item.author.name}</td>}
              <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(item.publishAt)}</td>
              {!compact && <td className="px-4 py-3 whitespace-nowrap text-muted" title={formatDateTime(item.updatedAt)}>{relative(item.updatedAt)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
