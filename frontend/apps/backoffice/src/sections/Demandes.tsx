import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_LABELS, type StudentRequest, type StudentRequestStatus } from '@esign/api';
import { Button, Status, formatDateTime, relativeTime, useToast } from '@esign/ui';
import { useApi } from '../api';
import { useHotkeys } from '../lib/keys';
import { DocumentForm, USAGES, emptyValues } from '../components/DocumentForm';

const ONGLETS: { status: StudentRequestStatus; label: string }[] = [
  { status: 'PENDING', label: 'À traiter' },
  { status: 'FULFILLED', label: 'Établies' },
  { status: 'REJECTED', label: 'Refusées' },
  { status: 'FAILED', label: 'Non abouties' },
];

/** Motifs de refus fréquents ; l'agent peut les compléter. Le motif est montré tel quel à l'étudiant. */
const MOTIFS = [
  'Les notes de ce semestre ne sont pas encore délibérées.',
  'Votre réinscription pour cette année n\'est pas finalisée.',
  'Aucune inscription ne correspond à cette année universitaire.',
  'Les données doivent être vérifiées : présentez-vous au service de scolarité.',
];

const periode = (r: StudentRequest) => `${r.academicYear}${r.semester ? `, semestre ${r.semester.slice(1)}` : ''}`;

export function DemandesSection({ openDocument }: { openDocument: (id: string) => void }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [onglet, setOnglet] = useState<StudentRequestStatus>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'detail' | 'saisie' | 'refus'>('detail');

  const apogee = useQuery({ queryKey: ['apogee-status'], queryFn: api.apogeeStatus, staleTime: 300_000 });
  const list = useQuery({ queryKey: ['requests', onglet], queryFn: () => api.studentRequests(onglet) });
  const rows = useMemo(() => list.data ?? [], [list.data]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const pending = onglet === 'PENDING';

  // Sélection par défaut : la première demande ; après traitement, la suivante.
  useEffect(() => {
    if (rows.length && !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0].id ?? null);
    if (!rows.length) setSelectedId(null);
  }, [rows, selectedId]);
  useEffect(() => { setMode('detail'); }, [selectedId]);
  useEffect(() => { setChecked(new Set()); }, [onglet]);

  /** Retire la demande traitée de la file et sélectionne la suivante. */
  const done = (id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    const next = rows[i + 1] ?? rows[i - 1];
    queryClient.setQueryData<StudentRequest[]>(['requests', 'PENDING'], (old) => old?.filter((r) => r.id !== id));
    setSelectedId(next?.id ?? null);
    setChecked((c) => { const n = new Set(c); n.delete(id); return n; });
    void queryClient.invalidateQueries({ queryKey: ['requests'] });
    void queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  const fromApogee = useMutation({
    mutationFn: (r: StudentRequest) => api.fulfillFromApogee(r.id!),
    onSuccess: (res, r) => {
      done(r.id!);
      toast({ message: `${DOCUMENT_LABELS[r.type!]} établi et signé pour ${r.studentName}.`,
        action: res.documentId ? { label: 'Ouvrir', run: () => openDocument(res.documentId!) } : undefined });
    },
    onError: (e) => toast({ message: (e as Error).message, error: true }),
  });

  // ------------------------------------------------------------------ traitement groupé
  const [lot, setLot] = useState<{ action: string; fait: number; total: number } | null>(null);
  const traiterLot = async (action: 'apogee' | 'refus', motif?: string) => {
    const ids = rows.filter((r) => checked.has(r.id!));
    setLot({ action: action === 'apogee' ? 'Établissement' : 'Refus', fait: 0, total: ids.length });
    const echecs: string[] = [];
    for (const [i, r] of ids.entries()) {
      try {
        if (action === 'apogee') await api.fulfillFromApogee(r.id!); else await api.reject(r.id!, motif!);
        done(r.id!);
      } catch (e) {
        echecs.push(`${r.studentName} : ${(e as Error).message}`);
      }
      setLot((l) => l && { ...l, fait: i + 1 });
    }
    setLot(null);
    const ok = ids.length - echecs.length;
    toast({ message: `${ok} demande${ok > 1 ? 's' : ''} ${action === 'apogee' ? 'établie' : 'refusée'}${ok > 1 ? 's' : ''}.`
      + (echecs.length ? ` ${echecs.length} en échec : ${echecs[0]}` : ''), error: echecs.length > 0 });
  };

  // ------------------------------------------------------------------ clavier
  const move = (step: number) => {
    const i = rows.findIndex((r) => r.id === selectedId);
    const next = rows[Math.min(rows.length - 1, Math.max(0, i + step))];
    if (next) { setSelectedId(next.id!); document.getElementById(`dem-${next.id}`)?.scrollIntoView({ block: 'nearest' }); }
  };
  useHotkeys({
    ArrowDown: () => move(1), ArrowUp: () => move(-1), j: () => move(1), k: () => move(-1),
    x: () => selected && toggle(selected.id!),
    a: () => { if (pending && selected && apogee.data?.viewEnabled && !fromApogee.isPending) fromApogee.mutate(selected); },
    s: () => pending && selected && setMode('saisie'),
    r: () => pending && selected && setMode('refus'),
  }, mode === 'detail' && !lot);

  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toutCoche = rows.length > 0 && rows.every((r) => checked.has(r.id!));

  return (
    <div className="section">
      <header className="section-tete">
        <h1>Demandes étudiantes</h1>
        <div className="onglets" role="tablist" aria-label="État des demandes">
          {ONGLETS.map((o) => (
            <button key={o.status} type="button" role="tab" aria-selected={onglet === o.status} onClick={() => setOnglet(o.status)}>
              {o.label}
              {o.status === 'PENDING' && list.data && onglet === 'PENDING' && <span className="num"> ({rows.length})</span>}
            </button>
          ))}
        </div>
      </header>

      {pending && checked.size > 0 && (
        <div className="lot" role="region" aria-label="Traitement groupé">
          {lot
            ? <span aria-live="polite">{lot.action} en cours : {lot.fait} sur {lot.total}</span>
            : <>
              <strong className="num">{checked.size} sélectionnée{checked.size > 1 ? 's' : ''}</strong>
              {apogee.data?.viewEnabled && <Button variant="sign" onClick={() => void traiterLot('apogee')}>Établir depuis Apogée</Button>}
              <RefusGroupe onConfirm={(m) => void traiterLot('refus', m)} />
              <Button variant="quiet" onClick={() => setChecked(new Set())}>Tout désélectionner</Button>
            </>}
        </div>
      )}

      <div className={`espace${mode === 'saisie' ? ' espace-large' : ''}`}>
        <div className="tableau-zone" aria-busy={list.isLoading}>
          {list.isError && <p className="erreur-chargement">Impossible de charger les demandes : {(list.error as Error).message} <Button onClick={() => void list.refetch()}>Réessayer</Button></p>}
          {list.isLoading && <Squelettes />}
          {list.data && rows.length === 0 && (
            <div className="vide">
              <h2>{pending ? 'Aucune demande en attente' : 'Rien à afficher'}</h2>
              <p>{pending ? 'Les nouvelles demandes des étudiants apparaîtront ici. La liste se met à jour toute seule.' : 'Aucune demande dans cette catégorie pour le moment.'}</p>
            </div>
          )}
          {rows.length > 0 && (
            <table className="tableau">
              <thead>
                <tr>
                  {pending && <th className="col-case"><input type="checkbox" aria-label="Tout sélectionner" checked={toutCoche}
                    onChange={() => setChecked(toutCoche ? new Set() : new Set(rows.map((r) => r.id!)))} /></th>}
                  <th scope="col">{pending ? 'Reçue' : 'Traitée'}</th>
                  <th scope="col">Étudiant</th>
                  <th scope="col">Document</th>
                  <th scope="col">{pending ? 'Usage' : 'Par'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} id={`dem-${r.id}`} aria-selected={r.id === selectedId} onClick={() => setSelectedId(r.id!)}>
                    {pending && <td className="col-case" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Sélectionner ${r.studentName}`} checked={checked.has(r.id!)} onChange={() => toggle(r.id!)} /></td>}
                    <td className="num quand" title={formatDateTime(pending ? r.createdAt : r.handledAt)}>{relativeTime(pending ? r.createdAt : r.handledAt)}</td>
                    <td><strong>{r.studentName}</strong><span className="sous num">{r.studentCne}</span></td>
                    <td>{DOCUMENT_LABELS[r.type!]}<span className="sous">{periode(r)}</span>
                      {pending && r.agentNote && <span className="etiquette etiquette-alerte" title={r.agentNote}>À vérifier</span>}</td>
                    <td>{pending ? (USAGES[r.purpose ?? ''] ?? r.purpose) : r.handledByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="panneau" aria-label="Détail de la demande">
          {!selected ? <p className="panneau-vide">Sélectionnez une demande.</p> : mode === 'saisie' ? (
            <>
              <h2>Établir pour {selected.studentName}</h2>
              <DocumentForm
                key={selected.id}
                initial={{ ...emptyValues(), type: selected.type!, cne: selected.studentCne!, academicYear: selected.academicYear!,
                  semester: selected.semester ?? 'S1', purpose: selected.purpose ?? '',
                  ...splitName(selected.studentName) }}
                locked={['type', 'cne', 'academicYear', 'semester', 'purpose']}
                submitLabel="Établir et signer"
                onCancel={() => setMode('detail')}
                onSubmit={async (data) => {
                  const res = await api.fulfill(selected.id!, data);
                  done(selected.id!);
                  toast({ message: `${DOCUMENT_LABELS[selected.type!]} établi et signé pour ${selected.studentName}.`,
                    action: res.documentId ? { label: 'Ouvrir', run: () => openDocument(res.documentId!) } : undefined });
                }} />
            </>
          ) : (
            <Detail r={selected} pending={pending} apogee={!!apogee.data?.viewEnabled} busy={fromApogee.isPending}
              refus={mode === 'refus'}
              onApogee={() => fromApogee.mutate(selected)}
              onSaisie={() => setMode('saisie')}
              onRefus={() => setMode('refus')}
              onCancelRefus={() => setMode('detail')}
              onReject={async (motif) => {
                await api.reject(selected.id!, motif);
                done(selected.id!);
                toast({ message: `Demande de ${selected.studentName} refusée. L'étudiant voit le motif.` });
              }}
              openDocument={openDocument} />
          )}
        </aside>
      </div>
    </div>
  );
}

/** « EL AMRANI Yasmine » → nom « El Amrani », prénom « Yasmine » (à vérifier par l'agent). */
function splitName(full?: string) {
  const parts = (full ?? '').trim().split(/\s+/);
  const nom = parts.filter((p) => p === p.toUpperCase() && /\p{L}/u.test(p));
  const prenom = parts.filter((p) => !nom.includes(p));
  const cap = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
  return nom.length && prenom.length ? { nom: cap(nom.join(' ')), prenom: prenom.join(' ') } : { nom: '', prenom: '' };
}

interface DetailProps {
  r: StudentRequest; pending: boolean; apogee: boolean; busy: boolean; refus: boolean;
  onApogee: () => void; onSaisie: () => void; onRefus: () => void; onCancelRefus: () => void;
  onReject: (motif: string) => Promise<void>; openDocument: (id: string) => void;
}

function Detail({ r, pending, apogee, busy, refus, onApogee, onSaisie, onRefus, onCancelRefus, onReject, openDocument }: DetailProps) {
  const statut = { PENDING: ['À traiter', 'attente'], FULFILLED: ['Établie', 'ok'], REJECTED: ['Refusée', 'ko'], FAILED: ['Non aboutie', 'ko'] } as const;
  const [label, tone] = statut[r.status!];
  return (
    <>
      <h2>{r.studentName}</h2>
      <Status tone={tone}>{label}</Status>
      <dl className="fiche">
        <dt>CNE</dt><dd className="num">{r.studentCne}</dd>
        <dt>Document</dt><dd>{DOCUMENT_LABELS[r.type!]}</dd>
        <dt>Période</dt><dd>{periode(r)}</dd>
        <dt>Usage</dt><dd>{USAGES[r.purpose ?? ''] ?? r.purpose}</dd>
        <dt>Demandée</dt><dd>{formatDateTime(r.createdAt)}</dd>
        {!pending && <><dt>Traitée</dt><dd>{formatDateTime(r.handledAt)} par {r.handledByName}</dd></>}
      </dl>
      {r.message && <p className={`encart${r.status === 'FULFILLED' ? '' : ' encart-ko'}`}>{r.message}</p>}
      {pending && r.agentNote && <p className="encart encart-attente"><strong>À vérifier : </strong>{r.agentNote}</p>}

      {pending && !refus && (
        <div className="actions">
          {apogee && <Button variant="sign" busy={busy} onClick={onApogee}>Établir depuis Apogée <kbd>A</kbd></Button>}
          <Button variant={apogee ? 'default' : 'sign'} onClick={onSaisie}>Saisir les données <kbd>S</kbd></Button>
          <Button variant="danger" onClick={onRefus}>Refuser <kbd>R</kbd></Button>
          {!apogee && <p className="champ-aide">Raccordement Apogée non activé : saisissez ou collez les données.</p>}
        </div>
      )}
      {pending && refus && <Refus onReject={onReject} onCancel={onCancelRefus} />}
      {r.documentId && <Button onClick={() => openDocument(r.documentId!)}>Ouvrir le document</Button>}
    </>
  );
}

function Refus({ onReject, onCancel }: { onReject: (motif: string) => Promise<void>; onCancel: () => void }) {
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <form className="refus" onSubmit={async (e) => {
      e.preventDefault();
      if (!motif.trim()) { setErreur('Indiquez le motif : il est affiché à l\'étudiant.'); return; }
      setBusy(true);
      try { await onReject(motif.trim()); } catch (err) { setErreur((err as Error).message); setBusy(false); }
    }}>
      <fieldset>
        <legend>Motif du refus, visible par l'étudiant</legend>
        <div className="motifs">
          {MOTIFS.map((m) => <button key={m} type="button" className="motif" onClick={() => { setMotif(m); ref.current?.focus(); }}>{m}</button>)}
        </div>
        <label className="champ"><span className="sr">Motif</span>
          <textarea ref={ref} value={motif} maxLength={1000} aria-invalid={!!erreur} onChange={(e) => { setMotif(e.target.value); setErreur(undefined); }}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()} />
        </label>
        {erreur && <p className="champ-erreur" role="alert">{erreur}</p>}
      </fieldset>
      <div className="actions-ligne">
        <Button type="submit" variant="danger-plein" busy={busy}>Refuser la demande</Button>
        <Button onClick={onCancel} disabled={busy}>Annuler</Button>
      </div>
    </form>
  );
}

function RefusGroupe({ onConfirm }: { onConfirm: (motif: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState(MOTIFS[0]);
  if (!ouvert) return <Button variant="danger" onClick={() => setOuvert(true)}>Refuser…</Button>;
  return (
    <span className="refus-groupe">
      <label className="sr" htmlFor="motif-groupe">Motif commun</label>
      <select id="motif-groupe" value={motif} onChange={(e) => setMotif(e.target.value)}>
        {MOTIFS.map((m) => <option key={m}>{m}</option>)}
      </select>
      <Button variant="danger-plein" onClick={() => { setOuvert(false); onConfirm(motif); }}>Refuser la sélection</Button>
      <Button variant="quiet" onClick={() => setOuvert(false)}>Annuler</Button>
    </span>
  );
}

function Squelettes() {
  return <div className="squelettes" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i} className="squelette" />)}</div>;
}
