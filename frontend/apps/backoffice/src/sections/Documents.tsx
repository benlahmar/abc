import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_LABELS, type AuditEvent, type DocumentQuery, type DocumentResponse, type DocumentStatus, type DocumentType } from '@esign/api';
import { Button, Dialog, Field, Status, formatDate, formatDateTime, useToast, type Tone } from '@esign/ui';
import { useApi } from '../api';
import { useHotkeys } from '../lib/keys';
import { DocumentForm, USAGES, currentAcademicYear, emptyValues } from '../components/DocumentForm';

export const STATUTS: Record<DocumentStatus, [string, Tone]> = {
  SIGNED: ['Signé', 'ok'], PENDING_APPROVAL: ['En validation', 'attente'], REJECTED: ['Refusé', 'ko'], REVOKED: ['Révoqué', 'ko'],
};

const EVENEMENTS: Record<string, string> = {
  DOCUMENT_ISSUED: 'Établi', DOCUMENT_SIGNED: 'Signé (cachet électronique)', DOCUMENT_REVOKED: 'Révoqué',
  STEP_APPROVED: 'Étape approuvée', STEP_REJECTED: 'Étape refusée', STUDENT_REQUEST: 'Demandé par l\'étudiant',
  STUDENT_REQUEST_FULFILLED: 'Demande traitée', STUDENT_REQUEST_REJECTED: 'Demande refusée',
};

const annees = () => { const a = Number(currentAcademicYear().slice(0, 4)); return Array.from({ length: 6 }, (_, i) => `${a - i}-${a - i + 1}`); };

/** Valeur différée : la recherche part quand l'agent cesse de taper. */
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export function DocumentsSection({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [filtres, setFiltres] = useState<Omit<DocumentQuery, 'q' | 'page' | 'size'>>({});
  const [page, setPage] = useState(0);
  const [creation, setCreation] = useState(false);
  const recherche = useRef<HTMLInputElement>(null);
  const query: DocumentQuery = { q: useDebounced(q.trim()), ...filtres, page, size: 25 };

  const results = useQuery({ queryKey: ['documents', query], queryFn: () => api.searchDocuments(query), placeholderData: keepPreviousData });
  const items = results.data?.items ?? [];
  useEffect(() => { setPage(0); }, [query.q, filtres]);

  const move = (step: number) => {
    const i = items.findIndex((d) => d.id === selectedId);
    const next = items[Math.min(items.length - 1, Math.max(0, i + step))];
    if (next) { onSelect(next.id!); document.getElementById(`doc-${next.id}`)?.scrollIntoView({ block: 'nearest' }); }
  };
  useHotkeys({
    '/': () => recherche.current?.focus(), n: () => setCreation(true),
    ArrowDown: () => move(1), ArrowUp: () => move(-1), j: () => move(1), k: () => move(-1),
  }, !creation);

  const filtre = <K extends keyof typeof filtres>(k: K, v: string) => setFiltres((f) => ({ ...f, [k]: v || undefined }));
  const total = results.data?.total ?? 0;

  return (
    <div className="section">
      <header className="section-tete">
        <h1>Documents</h1>
        <Button variant="primary" onClick={() => setCreation(true)}>Nouveau document <kbd>N</kbd></Button>
      </header>

      <div className="outils" role="search">
        <label className="recherche">
          <span className="sr">Rechercher</span>
          <input ref={recherche} type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="CNE, nom de l'étudiant ou référence" aria-keyshortcuts="/" />
        </label>
        <select aria-label="Type de document" value={filtres.type ?? ''} onChange={(e) => filtre('type', e.target.value as DocumentType)}>
          <option value="">Tous les documents</option>
          {Object.entries(DOCUMENT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select aria-label="État" value={filtres.status ?? ''} onChange={(e) => filtre('status', e.target.value as DocumentStatus)}>
          <option value="">Tous les états</option>
          {Object.entries(STATUTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select aria-label="Année universitaire" value={filtres.academicYear ?? ''} onChange={(e) => filtre('academicYear', e.target.value)}>
          <option value="">Toutes les années</option>
          {annees().map((a) => <option key={a}>{a}</option>)}
        </select>
        <span className="resultats num" aria-live="polite">{results.data ? `${total} document${total > 1 ? 's' : ''}` : ''}</span>
      </div>

      <div className={`espace${creation ? ' espace-large' : ''}`}>
        <div className="tableau-zone" aria-busy={results.isFetching}>
          {results.isError && <p className="erreur-chargement">Recherche impossible : {(results.error as Error).message} <Button onClick={() => void results.refetch()}>Réessayer</Button></p>}
          {results.data && items.length === 0 && (
            <div className="vide">
              <h2>Aucun document trouvé</h2>
              <p>{q || Object.values(filtres).some(Boolean) ? 'Vérifiez l\'orthographe ou retirez un filtre.' : 'Les documents établis apparaîtront ici.'}</p>
              {(q || Object.values(filtres).some(Boolean)) && <Button onClick={() => { setQ(''); setFiltres({}); }}>Effacer la recherche</Button>}
            </div>
          )}
          {items.length > 0 && (
            <table className="tableau">
              <thead>
                <tr><th scope="col">Étudiant</th><th scope="col">Document</th><th scope="col">État</th><th scope="col">Signé le</th><th scope="col">Établi par</th></tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} id={`doc-${d.id}`} aria-selected={d.id === selectedId} onClick={() => { setCreation(false); onSelect(d.id!); }}>
                    <td><strong>{d.studentName}</strong><span className="sous num">{d.studentCne}</span></td>
                    <td>{d.typeLabel}<span className="sous">{d.academicYear}{d.semester ? `, semestre ${d.semester.slice(1)}` : ''}</span></td>
                    <td><Status tone={STATUTS[d.status!][1]}>{STATUTS[d.status!][0]}</Status></td>
                    <td className="num">{formatDate(d.signedAt)}</td>
                    <td>{d.issuedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {results.data && results.data.totalPages! > 1 && (
            <nav className="pagination" aria-label="Pages de résultats">
              <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédents</Button>
              <span className="num">Page {page + 1} sur {results.data.totalPages}</span>
              <Button disabled={page + 1 >= results.data.totalPages!} onClick={() => setPage((p) => p + 1)}>Suivants</Button>
            </nav>
          )}
        </div>

        <aside className="panneau" aria-label="Détail du document">
          {creation ? (
            <>
              <h2>Nouveau document</h2>
              <NouveauDocument onCancel={() => setCreation(false)} onCreated={(doc) => {
                setCreation(false);
                void queryClient.invalidateQueries({ queryKey: ['documents'] });
                onSelect(doc.id!);
                toast({ message: doc.status === 'SIGNED' ? `${DOCUMENT_LABELS[doc.type!]} établi et signé pour ${doc.studentName}.`
                  : `${DOCUMENT_LABELS[doc.type!]} établi, en attente de validation.` });
              }} />
            </>
          ) : selectedId ? <Detail key={selectedId} id={selectedId} /> : <p className="panneau-vide">Sélectionnez un document, ou recherchez un étudiant par son CNE.</p>}
        </aside>
      </div>
    </div>
  );
}

function NouveauDocument({ onCancel, onCreated }: { onCancel: () => void; onCreated: (d: DocumentResponse) => void }) {
  const api = useApi();
  // Une clé par formulaire : un double clic ou un nouvel essai ne crée jamais deux documents
  const [cle] = useState(() => crypto.randomUUID());
  return <DocumentForm initial={emptyValues()} submitLabel="Établir et signer" onCancel={onCancel}
    onSubmit={async (data) => onCreated(await api.createDocument(data, cle))} />;
}

function Detail({ id }: { id: string }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const doc = useQuery({ queryKey: ['document', id], queryFn: () => api.document(id) });
  const history = useQuery({ queryKey: ['history', id], queryFn: () => api.documentHistory(id) });
  const [revocation, setRevocation] = useState(false);

  const telecharger = useMutation({
    mutationFn: () => api.downloadDocument(id),
    onSuccess: (blob) => {
      const d = doc.data!;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `${d.studentCne}-${d.type!.toLowerCase()}${d.semester ? '-' + d.semester : ''}.pdf` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: (e) => toast({ message: (e as Error).message, error: true }),
  });
  useHotkeys({ t: () => doc.data?.status === 'SIGNED' && telecharger.mutate() });

  if (doc.isLoading) return <p className="panneau-vide">Chargement…</p>;
  if (doc.isError || !doc.data) return <p className="erreur-chargement">Document introuvable.</p>;
  const d = doc.data;
  const [label, tone] = STATUTS[d.status!];

  return (
    <>
      <h2>{DOCUMENT_LABELS[d.type!]}{d.semester ? `, semestre ${d.semester.slice(1)}` : ''}</h2>
      <Status tone={tone}>{label}</Status>
      <dl className="fiche">
        <dt>Étudiant</dt><dd>{d.studentName}</dd>
        <dt>CNE</dt><dd className="num">{d.studentCne}</dd>
        <dt>Année</dt><dd>{d.academicYear}</dd>
        {d.purpose && <><dt>Usage</dt><dd>{USAGES[d.purpose] ?? d.purpose}</dd></>}
        <dt>Établi par</dt><dd>{d.issuedBy?.name}{d.issuedBy?.source === 'DECLARED' ? ' (déclaré par Apogée)' : d.issuedBy?.source === 'SYSTEM' ? ' (libre-service)' : ''}</dd>
        {d.signedAt && <><dt>Signé le</dt><dd>{formatDateTime(d.signedAt)}</dd></>}
        {d.signedAt && <><dt>Référence</dt><dd className="num ref">{d.verificationCode}</dd></>}
      </dl>
      {d.status === 'REVOKED' && <p className="encart encart-ko">Révoqué le {formatDateTime(d.revokedAt)} : {d.revocationReason}</p>}

      {d.status === 'SIGNED' && (
        <div className="actions">
          <Button variant="primary" busy={telecharger.isPending} onClick={() => telecharger.mutate()}>Télécharger le PDF <kbd>T</kbd></Button>
          <Button onClick={() => void navigator.clipboard.writeText(d.verificationUrl!).then(() => toast({ message: 'Lien de vérification copié.' }))}>Copier le lien de vérification</Button>
          <Button variant="danger" onClick={() => setRevocation(true)}>Révoquer…</Button>
        </div>
      )}

      {d.signedAt && <Apercu id={id} />}

      <h3>Historique</h3>
      {history.data?.length ? <Historique events={history.data} /> : <p className="champ-aide">{history.isLoading ? 'Chargement…' : 'Aucun événement.'}</p>}

      <Revocation open={revocation} doc={d} onClose={() => setRevocation(false)} onDone={() => {
        setRevocation(false);
        void queryClient.invalidateQueries({ queryKey: ['document', id] });
        void queryClient.invalidateQueries({ queryKey: ['history', id] });
        void queryClient.invalidateQueries({ queryKey: ['documents'] });
        toast({ message: 'Document révoqué : la vérification en ligne indique désormais qu\'il n\'est plus valable.' });
      }} />
    </>
  );
}

/** Aperçu du PDF signé dans le panneau. */
function Apercu({ id }: { id: string }) {
  const api = useApi();
  const [ouvert, setOuvert] = useState(false);
  const pdf = useQuery({ queryKey: ['pdf', id], queryFn: () => api.downloadDocument(id), enabled: ouvert, staleTime: Infinity });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!pdf.data) return;
    const u = URL.createObjectURL(pdf.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pdf.data]);
  if (!ouvert) return <Button variant="quiet" onClick={() => setOuvert(true)}>Afficher l'aperçu du PDF</Button>;
  return url ? <iframe className="apercu" src={`${url}#view=FitH&toolbar=0`} title="Aperçu du document signé" /> : <p className="champ-aide">Chargement de l'aperçu…</p>;
}

function Historique({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="historique">
      {events.map((e) => (
        <li key={e.id}>
          <strong>{EVENEMENTS[e.eventType!] ?? e.eventType}</strong>
          <span className="num">{formatDateTime(e.createdAt)}</span>
          <span>{e.actor}</span>
        </li>
      ))}
    </ol>
  );
}

function Revocation({ open, doc, onClose, onDone }: { open: boolean; doc: DocumentResponse; onClose: () => void; onDone: () => void }) {
  const api = useApi();
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setMotif(''); setErreur(undefined); } }, [open]);
  return (
    <Dialog open={open} title="Révoquer ce document ?" onClose={onClose}>
      <p>{DOCUMENT_LABELS[doc.type!]} de {doc.studentName} ({doc.academicYear}). La signature reste intacte, mais toute
        vérification indiquera que le document n'est plus valable. Cette action est définitive.</p>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!motif.trim()) { setErreur('Le motif est obligatoire : il est conservé dans le journal et montré à l\'étudiant.'); return; }
        setBusy(true);
        try { await api.revoke(doc.id!, motif.trim()); onDone(); } catch (err) { setErreur((err as Error).message); } finally { setBusy(false); }
      }}>
        <Field label="Motif de la révocation" error={erreur}>
          <textarea value={motif} maxLength={500} autoFocus aria-invalid={!!erreur} onChange={(e) => { setMotif(e.target.value); setErreur(undefined); }}
            placeholder="Ex. note du module M52 corrigée après réclamation" />
        </Field>
        <div className="dialogue-actions">
          <Button onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" variant="danger-plein" busy={busy}>Révoquer le document</Button>
        </div>
      </form>
    </Dialog>
  );
}
