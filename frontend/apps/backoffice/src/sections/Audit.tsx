import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { AuditEvent, AuditQuery, AuditVerification } from '@esign/api';
import { Button, Status, formatDateTime, useToast } from '@esign/ui';
import { useApi } from '../api';
import { useHotkeys } from '../lib/keys';
import { saveBlob } from '../lib/download';
import { describeChange } from '../lib/parametrage';
import { USAGES } from '../components/DocumentForm';
import { EVENEMENTS, RUBRIQUES, acteur, empreinteCourte, libelle, typesDe, type Rubrique } from '../lib/audit';

interface Filtres {
  q: string;
  rubrique: Rubrique | '';
  actor: string;
  from: string;
  to: string;
  documentId?: string;
}

const VIDE: Filtres = { q: '', rubrique: '', actor: '', from: '', to: '' };

/** Détail en clair pour le paramétrage (« Relevé de notes : Vice-doyen… »), brut sinon. */
const detail = (e: AuditEvent) => (e.eventType === 'WORKFLOW_UPDATED' || e.eventType === 'STUDENT_ACCESS_UPDATED'
  ? describeChange(e.eventType, e.details, USAGES) : e.details);

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export function AuditSection() {
  const api = useApi();
  const toast = useToast();
  const [filtres, setFiltres] = useState<Filtres>(VIDE);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditEvent>();
  const recherche = useRef<HTMLInputElement>(null);
  const differes = useDebounced(filtres);
  const query: AuditQuery = {
    q: differes.q.trim(), actor: differes.actor.trim(), from: differes.from, to: differes.to, documentId: differes.documentId,
    types: differes.rubrique ? typesDe(differes.rubrique) : undefined, page, size: 50,
  };
  useEffect(() => { setPage(0); }, [differes]);

  const journal = useQuery({ queryKey: ['audit', query], queryFn: () => api.auditSearch(query), placeholderData: keepPreviousData });
  const items = journal.data?.items ?? [];
  const total = journal.data?.total ?? 0;
  const actifs = Object.entries(filtres).some(([, v]) => !!v);
  const set = <K extends keyof Filtres>(k: K, v: Filtres[K]) => setFiltres((f) => ({ ...f, [k]: v }));

  const verification = useMutation({ mutationFn: api.verifyAudit });
  const exporter = useMutation({
    mutationFn: async () => saveBlob(await api.auditExport(query), `journal-audit${query.from ? `-${query.from}` : ''}${query.to ? `-au-${query.to}` : ''}.csv`),
    onError: (e) => toast({ message: (e as Error).message, error: true }),
  });

  const move = (step: number) => {
    const i = items.findIndex((e) => e.id === selected?.id);
    const next = items[Math.min(items.length - 1, Math.max(0, i + step))];
    if (next) { setSelected(next); document.getElementById(`evt-${next.id}`)?.scrollIntoView({ block: 'nearest' }); }
  };
  useHotkeys({ '/': () => recherche.current?.focus(), ArrowDown: () => move(1), ArrowUp: () => move(-1), j: () => move(1), k: () => move(-1) });

  return (
    <div className="section">
      <header className="section-tete">
        <h1>Journal d'audit</h1>
        <p className="section-aide">Toutes les actions, avec leur auteur. Événements chaînés par empreintes : une modification ou un retrait
          serait révélé par la vérification.</p>
        <Button variant="primary" className="pousse" busy={verification.isPending} onClick={() => verification.mutate()}>Vérifier l'intégrité</Button>
        <Button busy={exporter.isPending} disabled={!total} onClick={() => exporter.mutate()}
          title={total > 10000 ? 'Export limité aux 10 000 plus récents' : 'Exporter les événements affichés (tous les critères)'}>Exporter (CSV)</Button>
      </header>

      {(verification.data || verification.isError) && <Integrite r={verification.data} erreur={verification.error as Error | null} />}

      <div className="outils" role="search">
        <label className="recherche">
          <span className="sr">Rechercher</span>
          <input ref={recherche} type="search" value={filtres.q} onChange={(e) => set('q', e.target.value)}
            placeholder="CNE, nom, référence, motif…" aria-keyshortcuts="/" />
        </label>
        <select aria-label="Rubrique" value={filtres.rubrique} onChange={(e) => set('rubrique', e.target.value as Rubrique | '')}>
          <option value="">Toutes les rubriques</option>
          {RUBRIQUES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <label className="outil-court"><span className="sr">Acteur</span>
          <input type="search" value={filtres.actor} onChange={(e) => set('actor', e.target.value)} placeholder="Acteur" /></label>
        <label className="outil-date">Du <input type="date" value={filtres.from} max={filtres.to || undefined} onChange={(e) => set('from', e.target.value)} /></label>
        <label className="outil-date">au <input type="date" value={filtres.to} min={filtres.from || undefined} onChange={(e) => set('to', e.target.value)} /></label>
        {actifs && <Button variant="quiet" onClick={() => setFiltres(VIDE)}>Effacer</Button>}
        <span className="resultats num" aria-live="polite">{journal.data ? `${total.toLocaleString('fr-FR')} événement${total > 1 ? 's' : ''}` : ''}</span>
      </div>
      {filtres.documentId && (
        <div className="lot">
          <span>Événements du document <span className="num">{filtres.documentId}</span></span>
          <Button variant="quiet" onClick={() => set('documentId', undefined)}>Retirer ce filtre</Button>
        </div>
      )}

      <div className="espace espace-audit">
        <div className="tableau-zone" aria-busy={journal.isFetching}>
          {journal.isError && <p className="erreur-chargement">Journal indisponible : {(journal.error as Error).message} <Button onClick={() => void journal.refetch()}>Réessayer</Button></p>}
          {journal.isLoading && <div className="squelettes">{[0, 1, 2, 3].map((i) => <div key={i} className="squelette" />)}</div>}
          {journal.data && items.length === 0 && (
            <div className="vide"><h2>Aucun événement</h2><p>Aucun événement ne correspond à ces critères.</p>
              {actifs && <Button onClick={() => setFiltres(VIDE)}>Effacer les critères</Button>}</div>
          )}
          {items.length > 0 && (
            <table className="tableau journal-tableau">
              <thead><tr><th scope="col" className="num">N°</th><th scope="col">Date</th><th scope="col">Événement</th><th scope="col">Acteur</th><th scope="col">Détail</th></tr></thead>
              <tbody>
                {items.map((e) => {
                  const a = acteur(e.actor);
                  const def = EVENEMENTS[e.eventType ?? ''];
                  return (
                    <tr key={e.id} id={`evt-${e.id}`} aria-selected={e.id === selected?.id} onClick={() => setSelected(e)}>
                      <td className="num sous-ligne">{e.id}</td>
                      <td className="num quand">{formatDateTime(e.createdAt)}</td>
                      <td><strong className={def?.ton ? `ton-${def.ton}` : undefined}>{libelle(e.eventType)}</strong><span className="sous">{def?.rubrique ?? e.eventType}</span></td>
                      <td title={a.comment}>{a.qui}</td>
                      <td className="journal-detail-cellule" title={detail(e)}>{detail(e)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {journal.data && (journal.data.totalPages ?? 0) > 1 && (
            <nav className="pagination" aria-label="Pages">
              <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Plus récents</Button>
              <span className="num">Page {page + 1} sur {journal.data.totalPages}</span>
              <Button disabled={page + 1 >= journal.data.totalPages!} onClick={() => setPage((p) => p + 1)}>Plus anciens</Button>
            </nav>
          )}
        </div>

        <aside className="panneau" aria-label="Détail de l'événement">
          {selected ? <Detail e={selected} onDocument={(id) => { setFiltres({ ...VIDE, documentId: id }); }} />
            : <p className="panneau-vide">Sélectionnez un événement pour voir son détail et ses empreintes.</p>}
        </aside>
      </div>
    </div>
  );
}

function Detail({ e, onDocument }: { e: AuditEvent; onDocument: (id: string) => void }) {
  const a = acteur(e.actor);
  const def = EVENEMENTS[e.eventType ?? ''];
  return (
    <>
      <h2>{libelle(e.eventType)}</h2>
      <dl className="fiche">
        <dt>N°</dt><dd className="num">{e.id}</dd>
        <dt>Rubrique</dt><dd>{def?.rubrique ?? '—'} <span className="sous-ligne num">{e.eventType}</span></dd>
        <dt>Date</dt><dd>{formatDateTime(e.createdAt)}</dd>
        <dt>Acteur</dt><dd>{a.qui}{a.comment && <span className="sous">{a.comment}</span>}</dd>
        {e.documentId && <><dt>Document</dt><dd className="num ref">{e.documentId}</dd></>}
      </dl>
      {e.details && <p className="encart journal-texte">{detail(e)}</p>}
      {e.details && detail(e) !== e.details && <p className="champ-aide">Texte enregistré : <span className="num">{e.details}</span></p>}
      {e.documentId && <Button onClick={() => onDocument(e.documentId!)}>Tous les événements de ce document</Button>}
      <h3>Scellement</h3>
      <p className="champ-aide">Chaque événement est scellé avec l'empreinte du précédent (SHA-256) : modifier ou retirer un événement
        casse la chaîne à partir de lui.</p>
      <dl className="fiche empreintes">
        <dt>Précédente</dt><dd className="num">{e.previousHash}</dd>
        <dt>Celle-ci</dt><dd className="num">{e.hash}</dd>
      </dl>
    </>
  );
}

/** Résultat de la vérification de toute la chaîne, et empreinte de tête à noter hors de la plateforme. */
function Integrite({ r, erreur }: { r?: AuditVerification; erreur: Error | null }) {
  const toast = useToast();
  if (erreur) return <div className="lot integrite integrite-ko" role="alert">Vérification impossible : {erreur.message}</div>;
  if (!r) return null;
  return r.valid ? (
    <div className="lot integrite" role="status">
      <Status tone="ok">Journal intègre</Status>
      <span>{r.events?.toLocaleString('fr-FR')} événements chaînés depuis l'origine, vérifiés le {formatDateTime(r.checkedAt)}.</span>
      <span>Empreinte de tête : <button type="button" className="lien num" title={r.headHash}
        onClick={() => void navigator.clipboard.writeText(r.headHash!).then(() => toast({ message: 'Empreinte copiée : notez-la hors de la plateforme (registre, courriel au doyen).' }))}>
        {empreinteCourte(r.headHash)}</button> <span className="sous-ligne">(cliquer pour copier, à noter hors de la plateforme)</span></span>
    </div>
  ) : (
    <div className="lot integrite integrite-ko" role="alert">
      <Status tone="ko">Chaîne rompue</Status>
      <span>{r.firstInvalidEventId ? `À partir de l'événement n° ${r.firstInvalidEventId} : il a été modifié, ou un événement précédent a été retiré.`
        : 'Des événements récents ont été retirés (la tête de chaîne ne correspond plus).'} Prévenez le responsable de la plateforme.</span>
    </div>
  );
}
