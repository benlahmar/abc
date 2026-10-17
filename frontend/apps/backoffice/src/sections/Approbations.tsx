import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_LABELS, type ApprovalStep, type ApprovalTask } from '@esign/api';
import { useAuth } from '@esign/auth';
import { Button, Dialog, Status, formatDateTime, relativeTime, useToast } from '@esign/ui';
import { useApi } from '../api';
import { useHotkeys } from '../lib/keys';
import { USAGES } from '../components/DocumentForm';
import { roleLabel } from '../lib/parametrage';
import { ETAPE_STATUTS, MOTIFS_REFUS, afterApproval } from '../lib/approbations';
import { STATUTS } from './Documents';

type Onglet = 'a-decider' | 'decisions';

const periode = (t: { academicYear?: string; semester?: string }) => `${t.semester ? `${t.semester} · ` : ''}${t.academicYear ?? ''}`;

export function ApprobationsSection() {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('a-decider');
  const [selectedId, setSelectedId] = useState<string>();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [lot, setLot] = useState<{ fait: number; total: number }>();
  const [confirmLot, setConfirmLot] = useState(false);

  const taches = useQuery({ queryKey: ['approvals'], queryFn: api.approvals, refetchInterval: 60_000 });
  const decisions = useQuery({ queryKey: ['approval-decisions'], queryFn: api.approvalDecisions, enabled: onglet === 'decisions' });
  const rows = useMemo(() => taches.data ?? [], [taches.data]);
  // L'agent qui a établi un document ne peut pas l'approuver (séparation des tâches, contrôlée aussi par l'API)
  const mien = (t: ApprovalTask) => !!user && t.issuedBy?.id?.toLowerCase() === user.username.toLowerCase();

  // Sélection par défaut : la première tâche, puis la suivante après chaque décision
  useEffect(() => {
    if (onglet !== 'a-decider' || !taches.data) return;
    if (!selectedId || !rows.some((r) => r.documentId === selectedId)) setSelectedId(rows[0]?.documentId);
  }, [rows, selectedId, onglet, taches.data]);

  const apresDecision = (id: string) => {
    const i = rows.findIndex((r) => r.documentId === id);
    setSelectedId(rows[i + 1]?.documentId ?? rows[i - 1]?.documentId);
    setChecked((c) => { const n = new Set(c); n.delete(id); return n; });
    rafraichir();
  };
  // L'aperçu PDF ne change pas : seul l'état du circuit est relu
  const rafraichir = () => ['approvals', 'approval-decisions', 'approval-doc']
    .forEach((k) => void queryClient.invalidateQueries({ queryKey: [k] }));

  const move = (step: number) => {
    const list = onglet === 'a-decider' ? rows.map((r) => r.documentId!) : (decisions.data ?? []).map((d) => d.documentId!);
    const i = list.findIndex((id) => id === selectedId);
    const next = list[Math.min(list.length - 1, Math.max(0, i + step))];
    if (next) { setSelectedId(next); document.getElementById(`app-${next}`)?.scrollIntoView({ block: 'nearest' }); }
  };
  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  useHotkeys({ ArrowDown: () => move(1), ArrowUp: () => move(-1), j: () => move(1), k: () => move(-1),
    x: () => selectedId && onglet === 'a-decider' && toggle(selectedId) }, !lot);

  const eligibles = rows.filter((r) => !mien(r));
  const toutCoche = eligibles.length > 0 && eligibles.every((r) => checked.has(r.documentId!));

  const approuverLot = async () => {
    setConfirmLot(false);
    const ids = [...checked];
    let ok = 0;
    const echecs: string[] = [];
    setLot({ fait: 0, total: ids.length });
    for (const id of ids) {
      try { await api.approve(id); ok++; } catch (e) { echecs.push(`${rows.find((r) => r.documentId === id)?.studentName} : ${(e as Error).message}`); }
      setLot({ fait: ok + echecs.length, total: ids.length });
    }
    setLot(undefined);
    setChecked(new Set());
    rafraichir();
    toast({ message: `${ok} document${ok > 1 ? 's' : ''} approuvé${ok > 1 ? 's' : ''}.${echecs.length ? ` ${echecs.length} en échec : ${echecs.join(' ; ')}` : ''}`, error: echecs.length > 0 });
  };

  return (
    <div className="section">
      <header className="section-tete">
        <h1>Approbations</h1>
        <div className="onglets" role="tablist" aria-label="Approbations">
          <button type="button" role="tab" aria-selected={onglet === 'a-decider'} onClick={() => { setOnglet('a-decider'); setSelectedId(undefined); }}>
            À décider{taches.data ? <span className="num"> ({rows.length})</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={onglet === 'decisions'} onClick={() => { setOnglet('decisions'); setSelectedId(undefined); }}>Mes décisions</button>
        </div>
      </header>

      {onglet === 'a-decider' && checked.size > 0 && (
        <div className="lot" role="region" aria-label="Décision groupée">
          {lot ? <span aria-live="polite">Approbation en cours : {lot.fait} sur {lot.total}</span> : <>
            <strong className="num">{checked.size} sélectionné{checked.size > 1 ? 's' : ''}</strong>
            <Button variant="sign" onClick={() => setConfirmLot(true)}>Approuver la sélection</Button>
            <Button variant="quiet" onClick={() => setChecked(new Set())}>Tout désélectionner</Button>
          </>}
        </div>
      )}

      <div className="espace espace-approbations">
        <div className="tableau-zone" aria-busy={taches.isFetching}>
          {onglet === 'a-decider' ? (
            <>
              {taches.isError && <p className="erreur-chargement">Impossible de charger les approbations : {(taches.error as Error).message} <Button onClick={() => void taches.refetch()}>Réessayer</Button></p>}
              {taches.isLoading && <div className="squelettes">{[0, 1, 2].map((i) => <div key={i} className="squelette" />)}</div>}
              {taches.data && rows.length === 0 && (
                <div className="vide"><h2>Rien à décider</h2><p>Les documents qui attendent votre validation apparaîtront ici, selon le circuit paramétré.</p></div>
              )}
              {rows.length > 0 && (
                <table className="tableau">
                  <thead>
                    <tr>
                      <th scope="col" className="col-case"><input type="checkbox" aria-label="Tout sélectionner" checked={toutCoche}
                        onChange={() => setChecked(toutCoche ? new Set() : new Set(eligibles.map((r) => r.documentId!)))} /></th>
                      <th scope="col">Étudiant</th><th scope="col">Document</th><th scope="col">Étape</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.documentId} id={`app-${t.documentId}`} aria-selected={t.documentId === selectedId} onClick={() => setSelectedId(t.documentId)}>
                        <td className="col-case" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Sélectionner ${t.studentName}`} disabled={mien(t)}
                            checked={checked.has(t.documentId!)} onChange={() => toggle(t.documentId!)} />
                        </td>
                        <td><strong>{t.studentName}</strong><span className="sous num">{t.studentCne}</span></td>
                        <td>{t.documentType}<span className="sous num">{periode(t)}</span>
                          {t.purpose && <span className="etiquette">{USAGES[t.purpose] ?? t.purpose}</span>}</td>
                        <td>{roleLabel(t.role!)}<span className="sous">{(t.stepCount ?? 0) > 1 ? `étape ${t.stepNumber} sur ${t.stepCount}` : 'seule étape'}{t.escalated ? ', sur demande' : ''}</span>
                          <span className="sous" title={formatDateTime(t.requestedAt)}>établi {relativeTime(t.requestedAt)} par {t.issuedBy?.name}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <>
              {decisions.isLoading && <div className="squelettes">{[0, 1, 2].map((i) => <div key={i} className="squelette" />)}</div>}
              {decisions.data && decisions.data.length === 0 && <div className="vide"><h2>Aucune décision</h2><p>Vos approbations et refus apparaîtront ici.</p></div>}
              {!!decisions.data?.length && (
                <table className="tableau">
                  <thead><tr><th scope="col">Étudiant</th><th scope="col">Document</th><th scope="col">Ma décision</th><th scope="col">État du document</th></tr></thead>
                  <tbody>
                    {decisions.data.map((d) => (
                      <tr key={`${d.documentId}-${d.step}`} id={`app-${d.documentId}`} aria-selected={d.documentId === selectedId} onClick={() => setSelectedId(d.documentId)}>
                        <td><strong>{d.studentName}</strong><span className="sous num">{d.studentCne}</span></td>
                        <td>{DOCUMENT_LABELS[d.type!]}<span className="sous">{periode(d)}</span></td>
                        <td><Status tone={d.decision === 'APPROVED' ? 'ok' : 'ko'}>{d.decision === 'APPROVED' ? 'Approuvé' : 'Refusé'}</Status>
                          <span className="sous" title={formatDateTime(d.decidedAt)}>{relativeTime(d.decidedAt)}{d.comment ? ` · « ${d.comment} »` : ''}</span></td>
                        <td><Status tone={STATUTS[d.documentStatus!][1]}>{STATUTS[d.documentStatus!][0]}</Status></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        <aside className="panneau" aria-label="Document à examiner">
          {selectedId
            ? <Examen key={selectedId} id={selectedId} decision={onglet === 'a-decider'}
                tache={rows.find((r) => r.documentId === selectedId)} mien={!!rows.find((r) => r.documentId === selectedId && mien(r))}
                onDecided={() => apresDecision(selectedId)} />
            : <p className="panneau-vide">{onglet === 'a-decider' ? 'Sélectionnez un document pour l\'examiner.' : 'Sélectionnez une décision pour revoir le document.'}</p>}
        </aside>
      </div>

      <Dialog open={confirmLot} title={`Approuver ${checked.size} document${checked.size > 1 ? 's' : ''} ?`} onClose={() => setConfirmLot(false)}>
        <p>Votre approbation est enregistrée à votre nom pour chacun d'eux. Ceux dont c'est la dernière étape seront signés
          aussitôt avec le cachet de la faculté.</p>
        <div className="formulaire-actions">
          <Button variant="sign" onClick={() => void approuverLot()}>Approuver</Button>
          <Button onClick={() => setConfirmLot(false)}>Annuler</Button>
        </div>
      </Dialog>
    </div>
  );
}

interface ExamenProps {
  id: string;
  /** Faux : consultation d'une décision passée. */
  decision: boolean;
  tache?: ApprovalTask;
  mien: boolean;
  onDecided: () => void;
}

function Examen({ id, decision, tache, mien, onDecided }: ExamenProps) {
  const api = useApi();
  const toast = useToast();
  const doc = useQuery({ queryKey: ['approval-doc', id], queryFn: () => api.approvalDocument(id) });
  const [commentaire, setCommentaire] = useState('');
  const [escalade, setEscalade] = useState(false);
  const [refus, setRefus] = useState(false);
  const enAttente = decision && doc.data?.status === 'PENDING_APPROVAL';
  const suite = afterApproval(doc.data?.approvals, escalade);

  const approuver = useMutation({
    mutationFn: () => api.approve(id, { comment: commentaire.trim() || undefined, escalate: escalade || undefined }),
    onSuccess: (d) => {
      toast({ message: d.status === 'SIGNED' ? `Approuvé : le document de ${d.studentName} est signé.`
        : `Approuvé : le document de ${d.studentName} passe à l'étape suivante.` });
      onDecided();
    },
    onError: (e) => toast({ message: (e as Error).message, error: true }),
  });
  useHotkeys({
    a: () => enAttente && !mien && !approuver.isPending && approuver.mutate(),
    r: () => enAttente && !mien && setRefus(true),
  }, !refus);

  if (doc.isLoading) return <p className="panneau-vide">Chargement…</p>;
  if (doc.isError || !doc.data) return <p className="erreur-chargement">Document indisponible : {(doc.error as Error)?.message}</p>;
  const d = doc.data;

  return (
    <>
      <h2>{DOCUMENT_LABELS[d.type!]}{d.semester ? `, semestre ${d.semester.slice(1)}` : ''}</h2>
      <dl className="fiche">
        <dt>Étudiant</dt><dd>{d.studentName} <span className="sous-ligne num">{d.studentCne}</span></dd>
        <dt>Année</dt><dd>{d.academicYear}</dd>
        <dt>Usage</dt><dd>{d.purpose ? USAGES[d.purpose] ?? d.purpose : 'Non précisé'}</dd>
        <dt>Établi par</dt><dd>{d.issuedBy?.name}, {formatDateTime(d.createdAt)}</dd>
      </dl>

      <h3>Circuit</h3>
      <Circuit steps={d.approvals ?? []} />

      {enAttente && mien && <p className="encart encart-ko">Vous avez établi ce document : un autre validateur doit l'approuver.</p>}

      {enAttente && !mien && !refus && (
        <section className="decision" aria-label="Votre décision">
          <label className="champ"><span>Commentaire (facultatif)</span>
            <textarea value={commentaire} maxLength={500} rows={2} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ex. notes conformes au PV de délibération" />
          </label>
          {suite.canEscalate && (
            <label className="case">
              <input type="checkbox" checked={escalade} onChange={(e) => setEscalade(e.target.checked)} />
              Demander une validation supplémentaire ({afterApproval(d.approvals, true).next.map((s) => roleLabel(s.role!)).join(', ')})
            </label>
          )}
          <p className="champ-aide">{suite.signs ? 'Dernière étape : votre approbation déclenche la signature avec le cachet de la faculté.'
            : `Après votre approbation : ${suite.next.map((s) => s.name).join(', puis ')}.`}</p>
          <div className="actions-ligne">
            <Button variant={suite.signs ? 'sign' : 'primary'} busy={approuver.isPending} onClick={() => approuver.mutate()}>
              {suite.signs ? 'Approuver et signer' : 'Approuver'} <kbd>A</kbd>
            </Button>
            <Button variant="danger" onClick={() => setRefus(true)}>Refuser… <kbd>R</kbd></Button>
          </div>
        </section>
      )}
      {enAttente && refus && <Refus id={id} onCancel={() => setRefus(false)} onDone={onDecided} />}
      {!enAttente && <p className="champ-aide">État actuel : <Status tone={STATUTS[d.status!][1]}>{STATUTS[d.status!][0]}</Status></p>}

      {enAttente && <Apercu id={id} />}
      {tache && tache.escalated && <p className="champ-aide">Une validation supplémentaire a été demandée pour ce document.</p>}
    </>
  );
}

function Circuit({ steps }: { steps: ApprovalStep[] }) {
  return (
    <ol className="deroule">
      {steps.map((s) => {
        const [label, tone] = ETAPE_STATUTS[s.status!];
        return (
          <li key={s.order} className={`deroule-${s.status!.toLowerCase()}`}>
            <span className="deroule-nom">{s.name}<span className="sous">{roleLabel(s.role!)}</span></span>
            {tone === 'neutre' ? <span className="sous">{label}</span> : <Status tone={tone}>{label}</Status>}
            {s.decidedAt && <span className="deroule-detail">{s.decidedByName}, {formatDateTime(s.decidedAt)}{s.comment ? ` : « ${s.comment} »` : ''}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Refus({ id, onCancel, onDone }: { id: string; onCancel: () => void; onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string>();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const refuser = useMutation({
    mutationFn: () => api.rejectApproval(id, motif.trim()),
    onSuccess: (d) => { toast({ message: `Refusé : le document de ${d.studentName} ne sera pas signé.` }); onDone(); },
    onError: (e) => setErreur((e as Error).message),
  });
  return (
    <form className="refus" onSubmit={(e) => {
      e.preventDefault();
      if (!motif.trim()) { setErreur('Indiquez le motif : il est transmis au service de scolarité.'); return; }
      refuser.mutate();
    }}>
      <fieldset>
        <legend>Motif du refus</legend>
        <div className="motifs">
          {MOTIFS_REFUS.map((m) => <button key={m} type="button" className="motif" onClick={() => { setMotif(m); setErreur(undefined); ref.current?.focus(); }}>{m}</button>)}
        </div>
        <label className="champ"><span className="sr">Motif</span>
          <textarea ref={ref} value={motif} maxLength={500} aria-invalid={!!erreur} onChange={(e) => { setMotif(e.target.value); setErreur(undefined); }}
            onKeyDown={(e) => e.key === 'Escape' && onCancel()} />
        </label>
        {erreur && <p className="champ-erreur" role="alert">{erreur}</p>}
      </fieldset>
      <p className="champ-aide">Le document ne sera jamais signé ; le service devra en établir un nouveau si nécessaire.</p>
      <div className="actions-ligne">
        <Button type="submit" variant="danger-plein" busy={refuser.isPending}>Refuser le document</Button>
        <Button onClick={onCancel} disabled={refuser.isPending}>Annuler</Button>
      </div>
    </form>
  );
}

/** PDF non signé, tel qu'il sera délivré : affiché d'emblée, la décision se prend sur pièce. */
function Apercu({ id }: { id: string }) {
  const api = useApi();
  const pdf = useQuery({ queryKey: ['approval-preview', id], queryFn: () => api.approvalPreview(id), staleTime: Infinity });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!pdf.data) return;
    const u = URL.createObjectURL(pdf.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pdf.data]);
  return (
    <figure className="apercu-cadre">
      <figcaption>Aperçu, non signé</figcaption>
      {pdf.isError ? <p className="champ-erreur">Aperçu indisponible : {(pdf.error as Error).message}</p>
        : url ? <iframe className="apercu" src={url} title="Aperçu du document à approuver" /> : <div className="apercu squelette" />}
    </figure>
  );
}

