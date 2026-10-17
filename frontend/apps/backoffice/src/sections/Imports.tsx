import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, DOCUMENT_LABELS, type Batch, type BatchItemStatus, type DocumentType, type DryRunReport } from '@esign/api';
import { Button, Dialog, Field, Status, formatDateTime, relativeTime, useToast } from '@esign/ui';
import { useApi } from '../api';
import { useHotkeys } from '../lib/keys';
import { saveBlob } from '../lib/download';
import { ACCEPTED_EXTENSIONS, ELEMENT_STATUTS, LOT_STATUTS, checkImportFile, duration, enCours, formatLines, pluriel, progress, withoutLinePrefix } from '../lib/imports';
import { USAGES, currentAcademicYear } from '../components/DocumentForm';

const PLURIELS: Record<DocumentType, string> = { ATTESTATION_SCOLARITE: 'Attestations de scolarité', RELEVE_NOTES: 'Relevés de notes' };
const SEMESTRES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  openDocument: (id: string) => void;
}

export function ImportsSection({ selectedId, onSelect, openDocument }: Props) {
  const api = useApi();
  const [creation, setCreation] = useState(false);
  const [page, setPage] = useState(0);
  const lots = useQuery({
    queryKey: ['batches', page], queryFn: () => api.batches(page),
    // Suivi en direct tant qu'un traitement tourne
    refetchInterval: (q) => (q.state.data?.items?.some(enCours) ? 2000 : false),
  });
  const status = useQuery({ queryKey: ['apogee-status'], queryFn: api.apogeeStatus, staleTime: Infinity });
  const items = lots.data?.items ?? [];

  const move = (step: number) => {
    const i = items.findIndex((b) => b.id === selectedId);
    const next = items[Math.min(items.length - 1, Math.max(0, i + step))];
    if (next) onSelect(next.id!);
  };
  useHotkeys({ n: () => setCreation(true), ArrowDown: () => move(1), ArrowUp: () => move(-1), j: () => move(1), k: () => move(-1) }, !creation);

  return (
    <div className="section">
      <header className="section-tete">
        <h1>Imports Apogée</h1>
        <p className="section-aide">Relevés et attestations d'une promotion entière, depuis un export Apogée
          {status.data?.viewEnabled ? ' ou la vue Oracle' : ''}.</p>
        <Button variant="primary" onClick={() => setCreation(true)}>Nouvel import <kbd>N</kbd></Button>
      </header>

      <div className={`espace${creation ? ' espace-large' : ''}`}>
        <div className="tableau-zone" aria-busy={lots.isFetching}>
          {lots.isLoading && <div className="squelettes">{[0, 1, 2].map((i) => <div key={i} className="squelette" />)}</div>}
          {lots.isError && <p className="erreur-chargement">Liste indisponible : {(lots.error as Error).message} <Button onClick={() => void lots.refetch()}>Réessayer</Button></p>}
          {lots.data && items.length === 0 && (
            <div className="vide">
              <h2>Aucun import pour l'instant</h2>
              <p>Déposez un export Apogée (une ligne par étudiant et par module) : il est d'abord vérifié, rien n'est signé
                avant votre confirmation.</p>
              <div className="actions-ligne">
                <Button variant="primary" onClick={() => setCreation(true)}>Importer un export</Button>
                <a className="btn" href="/modele-export-apogee.csv" download>Modèle de fichier</a>
              </div>
            </div>
          )}
          {items.length > 0 && (
            <table className="tableau">
              <thead>
                <tr><th scope="col">Import</th><th scope="col">Documents</th><th scope="col" className="col-avancement">Avancement</th><th scope="col">Lancé</th></tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} aria-selected={b.id === selectedId} onClick={() => { setCreation(false); onSelect(b.id!); }}>
                    <td><strong>{b.description}</strong><span className="sous">{b.issuedBy?.name}</span></td>
                    <td>{DOCUMENT_LABELS[b.type!]}<span className="sous num">{pluriel(b.total ?? 0, 'document')}</span></td>
                    <td><Avancement lot={b} compact /></td>
                    <td className="quand" title={formatDateTime(b.createdAt)}>{relativeTime(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lots.data && lots.data.totalPages! > 1 && (
            <nav className="pagination" aria-label="Pages">
              <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Plus récents</Button>
              <span className="num">Page {page + 1} sur {lots.data.totalPages}</span>
              <Button disabled={page + 1 >= lots.data.totalPages!} onClick={() => setPage((p) => p + 1)}>Plus anciens</Button>
            </nav>
          )}
        </div>

        <aside className="panneau" aria-label={creation ? 'Nouvel import' : 'Détail de l\'import'}>
          {creation ? (
            <NouvelImport viewEnabled={!!status.data?.viewEnabled} onCancel={() => setCreation(false)}
              onLaunched={(b) => { setCreation(false); setPage(0); onSelect(b.id!); }} />
          ) : selectedId ? <Lot key={selectedId} id={selectedId} openDocument={openDocument} />
            : <p className="panneau-vide">Sélectionnez un import pour suivre la signature, télécharger les PDF et le rapport.</p>}
        </aside>
      </div>
    </div>
  );
}

/** Barre d'avancement : établis (vert) et en erreur (rouge) sur le total. */
function Avancement({ lot, compact }: { lot: Batch; compact?: boolean }) {
  const p = progress(lot);
  const [label, tone] = LOT_STATUTS[lot.status!];
  return (
    <div className={`avancement${compact ? ' compact' : ''}`}>
      <div className="avancement-barre" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done + p.failed}
        aria-label={`${p.done + p.failed} sur ${p.total} traités`}>
        <span className="ok" style={{ width: `${p.donePct}%` }} />
        <span className="ko" style={{ width: `${p.failedPct}%` }} />
      </div>
      <div className="avancement-texte">
        <Status tone={tone}>{label}</Status>
        <span className="num">{p.done}/{p.total}{p.failed ? ` · ${p.failed} en erreur` : ''}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------- nouvel import

type Source = 'fichier' | 'vue';

function NouvelImport({ viewEnabled, onCancel, onLaunched }: { viewEnabled: boolean; onCancel: () => void; onLaunched: (b: Batch) => void }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<Source>('fichier');
  const [type, setType] = useState<DocumentType>('RELEVE_NOTES');
  const [purpose, setPurpose] = useState('');
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [vue, setVue] = useState({ academicYear: currentAcademicYear(), semester: 'S1', filiere: '' });
  const [report, setReport] = useState<DryRunReport>();
  const [confirmation, setConfirmation] = useState(false);
  const [survol, setSurvol] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Toute modification des critères invalide la vérification précédente
  const reset = () => { setReport(undefined); verification.reset(); };
  const extraction = () => ({
    type, academicYear: vue.academicYear.trim(), purpose: purpose || undefined,
    semester: type === 'RELEVE_NOTES' ? vue.semester : undefined, filiere: vue.filiere.trim() || undefined,
  });

  const verification = useMutation({
    mutationFn: () => (source === 'fichier' ? api.checkFile(file!, { type, purpose: purpose || undefined }) : api.checkApogee(extraction())),
    onSuccess: setReport,
  });
  const lancement = useMutation({
    mutationFn: () => (source === 'fichier' ? api.importFile(file!, { type, purpose: purpose || undefined }) : api.extractApogee(extraction())),
    onSuccess: (b) => {
      setConfirmation(false);
      void queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast({ message: `Signature de ${pluriel(b.total! - b.failed!, 'document')} lancée. Vous pouvez quitter cette page : le traitement continue.` });
      onLaunched(b);
    },
  });

  const choisir = (f?: File) => {
    if (!f) return;
    reset();
    const err = checkImportFile(f);
    setFileError(err);
    setFile(err ? undefined : f);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setSurvol(false); choisir(e.dataTransfer.files[0]); };

  const verifier = (e: FormEvent) => {
    e.preventDefault();
    if (source === 'fichier' && !file) { setFileError('Choisissez d\'abord un fichier.'); return; }
    verification.mutate();
  };

  const erreurVerif = verification.error instanceof ApiError || verification.error instanceof Error ? verification.error.message : undefined;
  const pret = report && (report.valid ?? 0) > 0;

  return (
    <>
      <h2>Nouvel import</h2>
      <ol className="etapes" aria-label="Étapes">
        <li aria-current={!report ? 'step' : undefined}>Données</li>
        <li aria-current={report ? 'step' : undefined}>Vérification</li>
        <li>Signature</li>
      </ol>

      <form className="formulaire" onSubmit={verifier} noValidate>
        {viewEnabled && (
          <fieldset className="choix">
            <legend>Source</legend>
            <label><input type="radio" name="source" checked={source === 'fichier'} onChange={() => { setSource('fichier'); reset(); }} />Fichier exporté d'Apogée</label>
            <label><input type="radio" name="source" checked={source === 'vue'} onChange={() => { setSource('vue'); reset(); }} />Vue Oracle Apogée</label>
          </fieldset>
        )}

        <fieldset className="choix">
          <legend>Documents à produire</legend>
          {(Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((t) => (
            <label key={t}><input type="radio" name="type" checked={type === t} onChange={() => { setType(t); reset(); }} />{PLURIELS[t]}</label>
          ))}
        </fieldset>

        {source === 'fichier' ? (
          <div>
            <div className={`depot${survol ? ' survol' : ''}${file ? ' rempli' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setSurvol(true); }} onDragLeave={() => setSurvol(false)} onDrop={onDrop}>
              {file ? (
                <>
                  <strong className="depot-nom">{file.name}</strong>
                  <span className="sous num">{(file.size / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko</span>
                  <Button variant="quiet" onClick={() => input.current?.click()}>Choisir un autre fichier</Button>
                </>
              ) : (
                <>
                  <strong>Déposez l'export Apogée ici</strong>
                  <span className="sous">CSV ou Excel (.xlsx, .xls), 20 Mo au plus</span>
                  <Button onClick={() => input.current?.click()}>Parcourir…</Button>
                </>
              )}
              <input ref={input} type="file" hidden accept={ACCEPTED_EXTENSIONS.join(',')} onChange={(e) => { choisir(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            {fileError && <p className="champ-erreur" role="alert">{fileError}</p>}
            <p className="champ-aide">Une ligne par étudiant et par module ; les noms de colonnes sont reconnus sans tenir compte
              des accents ni de la casse. <a href="/modele-export-apogee.csv" download>Télécharger le modèle</a></p>
          </div>
        ) : (
          <div className="grille-3">
            <Field label="Année universitaire">
              <input value={vue.academicYear} onChange={(e) => { setVue({ ...vue, academicYear: e.target.value }); reset(); }} placeholder="2025-2026" />
            </Field>
            {type === 'RELEVE_NOTES' && (
              <Field label="Semestre">
                <select value={vue.semester} onChange={(e) => { setVue({ ...vue, semester: e.target.value }); reset(); }}>
                  {SEMESTRES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <Field label="Filière" hint="Facultatif : toute la faculté sinon">
              <input value={vue.filiere} onChange={(e) => { setVue({ ...vue, filiere: e.target.value }); reset(); }} />
            </Field>
          </div>
        )}

        <Field label="Usage des documents">
          <select value={purpose} onChange={(e) => { setPurpose(e.target.value); reset(); }}>
            {Object.entries(USAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>

        {erreurVerif && <p className="formulaire-message erreur" role="alert">{erreurVerif}</p>}
        {!report && (
          <div className="formulaire-actions">
            <Button type="submit" variant="primary" busy={verification.isPending}>
              {source === 'fichier' ? 'Vérifier le fichier' : 'Vérifier les données'}
            </Button>
            <Button onClick={onCancel}>Annuler</Button>
          </div>
        )}
      </form>

      {report && (
        <>
          <Rapport report={report} />
          <div className="formulaire-actions">
            <Button variant="sign" disabled={!pret} onClick={() => setConfirmation(true)}>
              Signer {pluriel(report.valid ?? 0, 'document')}
            </Button>
            <Button onClick={reset}>Modifier</Button>
            <Button variant="quiet" onClick={onCancel}>Abandonner</Button>
          </div>
        </>
      )}

      <Dialog open={confirmation} title={`Signer ${pluriel(report?.valid ?? 0, 'document')} ?`} onClose={() => setConfirmation(false)}>
        <p>Chaque document recevra le cachet électronique de la faculté, à votre nom. La signature se fait en
          arrière-plan : vous pouvez fermer cette page.</p>
        {(report?.invalid ?? 0) > 0 && (
          <p className="encart encart-ko">{pluriel(report!.invalid!, 'document')} à corriger ne {report!.invalid! > 1 ? 'seront' : 'sera'} pas
            {report!.invalid! > 1 ? ' produits' : ' produit'} ; {report!.invalid! > 1 ? 'ils figureront' : 'il figurera'} en erreur dans le rapport.</p>
        )}
        {lancement.isError && <p className="champ-erreur" role="alert">{(lancement.error as Error).message}</p>}
        <div className="formulaire-actions">
          <Button variant="sign" busy={lancement.isPending} onClick={() => lancement.mutate()}>Signer {pluriel(report?.valid ?? 0, 'document')}</Button>
          <Button onClick={() => setConfirmation(false)} disabled={lancement.isPending}>Annuler</Button>
        </div>
      </Dialog>
    </>
  );
}

/** Résultat de la vérification : chiffres, erreurs à corriger, aperçu de ce qui sera signé. */
function Rapport({ report }: { report: DryRunReport }) {
  const [filtre, setFiltre] = useState('');
  const [toutes, setToutes] = useState(false);
  const problems = report.problems ?? [];
  const preview = report.preview ?? [];
  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return f ? preview.filter((p) => `${p.cne} ${p.student} ${p.filiere}`.toLowerCase().includes(f)) : preview;
  }, [preview, filtre]);
  const MAX = 8;

  return (
    <section className="rapport" aria-label="Résultat de la vérification">
      <dl className="compteurs">
        <div><dt>Lignes lues</dt><dd className="num">{report.rows?.toLocaleString('fr-FR')}</dd></div>
        <div><dt>Documents</dt><dd className="num">{report.documents?.toLocaleString('fr-FR')}</dd></div>
        <div className="ok"><dt>Prêts à signer</dt><dd className="num">{report.valid?.toLocaleString('fr-FR')}</dd></div>
        <div className={report.invalid ? 'ko' : ''}><dt>À corriger</dt><dd className="num">{report.invalid?.toLocaleString('fr-FR')}</dd></div>
      </dl>

      {problems.length > 0 && (
        <>
          <h3>À corriger dans Apogée ou dans le fichier</h3>
          <p className="champ-aide">Ces documents ne bloquent pas les autres. Corrigez-les puis réimportez seulement les lignes concernées.</p>
          <ul className="problemes">
            {(toutes ? problems : problems.slice(0, MAX)).map((p) => (
              <li key={p.key}>
                <div><strong className="num">{p.key}</strong> <span className="sous-ligne">{formatLines(p.lines)}</span></div>
                <ul>{p.errors?.map((e) => <li key={e}>{withoutLinePrefix(e)}</li>)}</ul>
              </li>
            ))}
          </ul>
          {problems.length > MAX && !toutes && <Button variant="quiet" onClick={() => setToutes(true)}>Afficher les {problems.length - MAX} autres</Button>}
        </>
      )}

      {preview.length > 0 && (
        <>
          <h3>Documents prêts à signer</h3>
          {preview.length > 10 && (
            <label className="recherche">
              <span className="sr">Filtrer l'aperçu</span>
              <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer par CNE, nom ou filière" />
            </label>
          )}
          <div className="apercu-lot">
            <table className="tableau">
              <thead><tr><th scope="col">Étudiant</th><th scope="col">Filière</th>{preview[0].semester && <th scope="col">Sem.</th>}{preview[0].modules ? <th scope="col" className="num">Modules</th> : null}</tr></thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.key}>
                    <td>{p.student}<span className="sous num">{p.cne}</span></td>
                    <td>{p.filiere}<span className="sous">{p.niveau}</span></td>
                    {preview[0].semester && <td>{p.semester}</td>}
                    {preview[0].modules ? <td className="num">{p.modules}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(report.valid ?? 0) > preview.length && <p className="champ-aide">Aperçu limité aux {preview.length} premiers documents.</p>}
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------------- détail d'un import

type Filtre = BatchItemStatus | 'TOUS';

function Lot({ id, openDocument }: { id: string; openDocument: (id: string) => void }) {
  const api = useApi();
  const toast = useToast();
  const lot = useQuery({ queryKey: ['batch', id], queryFn: () => api.batch(id), refetchInterval: (q) => (enCours(q.state.data) ? 2000 : false) });
  const running = enCours(lot.data);
  const elements = useQuery({ queryKey: ['batch-items', id], queryFn: () => api.batchItems(id), refetchInterval: running ? 4000 : false });
  const [choix, setChoix] = useState<Filtre>();
  // Dernière lecture du détail à la fin du traitement (le suivi périodique s'arrête avec lui)
  const { refetch } = elements;
  useEffect(() => { if (lot.data && !running) void refetch(); }, [running, lot.data?.status, refetch]);

  const telecharger = useMutation({
    mutationFn: async (fichier: 'report.csv' | 'archive.zip') => saveBlob(await api.downloadBatchFile(id, fichier),
      fichier === 'archive.zip' ? `import-${id.slice(0, 8)}.zip` : `rapport-import-${id.slice(0, 8)}.csv`),
    onError: (e) => toast({ message: (e as Error).message, error: true }),
  });
  useHotkeys({ t: () => (lot.data?.succeeded ?? 0) > 0 && !running && telecharger.mutate('archive.zip') });

  const counts = useMemo(() => {
    const c: Record<Filtre, number> = { TOUS: 0, SIGNED: 0, AWAITING_APPROVAL: 0, PENDING: 0, FAILED: 0 };
    elements.data?.forEach((i) => { c.TOUS++; c[i.status!]++; });
    return c;
  }, [elements.data]);
  const filtre: Filtre = choix ?? (counts.FAILED > 0 && !running ? 'FAILED' : 'TOUS');
  const liste = (elements.data ?? []).filter((i) => filtre === 'TOUS' || i.status === filtre);

  if (lot.isLoading) return <p className="panneau-vide">Chargement…</p>;
  if (lot.isError || !lot.data) return <p className="erreur-chargement">Import introuvable.</p>;
  const b = lot.data;
  const p = progress(b);

  return (
    <>
      <h2>{b.description}</h2>
      <Avancement lot={b} />
      {running && <p className="champ-aide" aria-live="polite">{pluriel(p.remaining, 'document restant', 'documents restants')}. Le traitement continue si vous quittez la page.</p>}

      <dl className="fiche">
        <dt>Documents</dt><dd>{DOCUMENT_LABELS[b.type!]}{b.purpose ? `, ${USAGES[b.purpose] ?? b.purpose}` : ''}</dd>
        <dt>Source</dt><dd>{b.source === 'APOGEE_VIEW' ? 'Vue Oracle Apogée' : 'Fichier exporté d\'Apogée'}</dd>
        <dt>Lancé par</dt><dd>{b.issuedBy?.name}</dd>
        <dt>Lancé le</dt><dd>{formatDateTime(b.createdAt)}</dd>
        {b.finishedAt && <><dt>Terminé</dt><dd>{formatDateTime(b.finishedAt)} <span className="sous-ligne">({duration(b.startedAt ?? b.createdAt, b.finishedAt)})</span></dd></>}
      </dl>

      <div className="actions">
        <Button variant="primary" disabled={running || !p.done} busy={telecharger.isPending && telecharger.variables === 'archive.zip'}
          onClick={() => telecharger.mutate('archive.zip')}>Télécharger les PDF signés (ZIP) <kbd>T</kbd></Button>
        <Button busy={telecharger.isPending && telecharger.variables === 'report.csv'} onClick={() => telecharger.mutate('report.csv')}>
          Rapport pour Excel (CSV)</Button>
      </div>

      <h3>Détail par document</h3>
      <div className="onglets" role="tablist" aria-label="Filtrer les documents">
        {(['TOUS', 'FAILED', 'SIGNED', 'AWAITING_APPROVAL', 'PENDING'] as Filtre[]).filter((f) => f === 'TOUS' || counts[f] > 0).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filtre === f} onClick={() => setChoix(f)}>
            {f === 'TOUS' ? 'Tous' : ELEMENT_STATUTS[f][0]} <span className="num">{counts[f]}</span>
          </button>
        ))}
      </div>
      {elements.isLoading ? <p className="champ-aide">Chargement…</p> : (
        <ul className="elements">
          {liste.map((i) => (
            <li key={i.key}>
              <div className="elements-tete">
                <strong className="num">{i.key}</strong>
                <Status tone={ELEMENT_STATUTS[i.status!][1]}>{ELEMENT_STATUTS[i.status!][0]}</Status>
              </div>
              {i.error && <p className="elements-erreur">{withoutLinePrefix(i.error)} <span className="sous-ligne">{formatLines(i.lines)}</span></p>}
              {i.documentId && <button type="button" className="lien" onClick={() => openDocument(i.documentId!)}>Voir le document</button>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
