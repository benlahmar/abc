import { useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, DOCUMENT_LABELS, DOCUMENT_PLURALS, type DocumentType, type StudentAccessMode, type StudentAccessSetting, type WorkflowCondition, type WorkflowStep } from '@esign/api';
import { Button, Dialog, Field, formatDateTime, useToast } from '@esign/ui';
import { useApi } from '../api';
import { USAGES } from '../components/DocumentForm';
import { CONDITIONS, MODES, modesFor, ROLES, checkSteps, describeChange, emptyStep, nameForRole, normalize, roleLabel, sameSteps, simulate } from '../lib/parametrage';

type Onglet = 'circuit' | 'demandes' | 'historique';
const TYPES = Object.keys(DOCUMENT_LABELS) as DocumentType[];
/** Usages proposés pour une étape conditionnelle (sans « Non précisé »). */
const USAGES_DECLARES = Object.entries(USAGES).filter(([k]) => k);

export function ParametrageSection() {
  const [onglet, setOnglet] = useState<Onglet>('circuit');
  const onglets: [Onglet, string][] = [['circuit', 'Circuit de validation'], ['demandes', 'Demandes en ligne'], ['historique', 'Historique']];
  return (
    <div className="section">
      <header className="section-tete">
        <h1>Paramétrage</h1>
        <div className="onglets" role="tablist" aria-label="Rubriques">
          {onglets.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={onglet === k} onClick={() => setOnglet(k)}>{l}</button>
          ))}
        </div>
      </header>
      <div className="reglages">
        {onglet === 'circuit' && <Circuits />}
        {onglet === 'demandes' && <DemandesEnLigne />}
        {onglet === 'historique' && <Historique />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------- circuit de validation

function Circuits() {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ['workflows'], queryFn: api.workflows });
  const [type, setType] = useState<DocumentType>('RELEVE_NOTES');
  const [drafts, setDrafts] = useState<Partial<Record<DocumentType, WorkflowStep[]>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState(false);

  const enregistre = (t: DocumentType) => saved.data?.find((w) => w.type === t)?.steps ?? [];
  const steps = drafts[type] ?? enregistre(type);
  const modifie = (t: DocumentType) => !!drafts[t] && !sameSteps(drafts[t]!, enregistre(t));
  const dirty = modifie(type);
  const nonEnregistres = TYPES.some(modifie);

  // Prévient la perte de modifications en quittant la page
  useEffect(() => {
    if (!nonEnregistres) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [nonEnregistres]);

  const setSteps = (next: WorkflowStep[]) => { setDrafts((d) => ({ ...d, [type]: next })); setErrors({}); };
  const update = (i: number, patch: Partial<WorkflowStep>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, step: number) => {
    const next = [...steps];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    setSteps(next);
  };

  const sauvegarde = useMutation({
    mutationFn: () => api.saveWorkflow(type, normalize(steps)),
    onSuccess: (w) => {
      queryClient.setQueryData(['workflows'], (old: typeof saved.data) => old?.map((x) => (x.type === type ? w : x)));
      void queryClient.invalidateQueries({ queryKey: ['audit-config'] });
      setDrafts((d) => ({ ...d, [type]: undefined }));
      setConfirmation(false);
      toast({ message: `Circuit des ${DOCUMENT_PLURALS[type].toLowerCase()} enregistré. Il s'applique aux nouveaux documents.` });
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message])));
    },
  });

  const enregistrer = () => {
    const found = checkSteps(steps);
    setErrors(found);
    if (Object.keys(found).length) return;
    sauvegarde.reset();
    setConfirmation(true);
  };

  if (saved.isLoading) return <p className="champ-aide">Chargement…</p>;
  if (saved.isError) return <p className="erreur-chargement">Paramétrage indisponible : {(saved.error as Error).message}</p>;

  return (
    <div className="reglages-grille">
      <div>
        <div className="segments" role="tablist" aria-label="Type de document">
          {TYPES.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => { setType(t); setErrors({}); }}>
              {DOCUMENT_LABELS[t]}
              <span className="segments-sous">{(drafts[t] ?? enregistre(t)).length ? pluralEtapes((drafts[t] ?? enregistre(t)).length) : 'Signature immédiate'}{modifie(t) ? ' · modifié' : ''}</span>
            </button>
          ))}
        </div>

        <p className="champ-aide">Les étapes s'enchaînent dans l'ordre ; une étape dont la condition n'est pas remplie est passée.
          Sans étape, le document est signé dès qu'il est établi.</p>

        <ol className="circuit">
          <li className="circuit-borne">
            <strong>Établi par l'agent de scolarité</strong>
            <span className="sous">Depuis une demande, un import Apogée ou une saisie</span>
          </li>
          {steps.map((s, i) => (
            <Etape key={i} index={i} step={s} total={steps.length} errors={errors}
              onChange={(patch) => update(i, patch)} onMove={(d) => move(i, d)}
              onRemove={() => setSteps(steps.filter((_, j) => j !== i))} />
          ))}
          <li className="circuit-ajout">
            <Button onClick={() => setSteps([...steps, emptyStep()])} disabled={steps.length >= 10}>Ajouter une étape de validation</Button>
          </li>
          <li className="circuit-borne circuit-cachet">
            <strong>Cachet électronique de la faculté</strong>
            <span className="sous">Signature PAdES, QR code de vérification</span>
          </li>
        </ol>
      </div>

      <aside className="reglages-cote">
        <Simulation steps={steps} />
      </aside>

      {dirty && (
        <div className="barre-enregistrer" role="region" aria-label="Modifications non enregistrées">
          <span>Circuit des {DOCUMENT_PLURALS[type].toLowerCase()} modifié, non enregistré.</span>
          <Button variant="primary" onClick={enregistrer}>Enregistrer le circuit</Button>
          <Button onClick={() => { setDrafts((d) => ({ ...d, [type]: undefined })); setErrors({}); }}>Annuler les modifications</Button>
        </div>
      )}

      <Dialog open={confirmation} title="Enregistrer ce circuit ?" onClose={() => setConfirmation(false)}>
        <p><strong>{DOCUMENT_LABELS[type]}</strong> : {steps.length ? normalize(steps).map((s) => describeStep(s)).join(', puis ') + ', puis cachet de la faculté.' : 'signature immédiate, sans validation.'}</p>
        <p className="champ-aide">Les documents déjà en cours de validation gardent le circuit en vigueur lors de leur création.
          La modification est inscrite au journal d'audit.</p>
        {sauvegarde.isError && <p className="champ-erreur" role="alert">{(sauvegarde.error as Error).message}</p>}
        <div className="formulaire-actions">
          <Button variant="primary" busy={sauvegarde.isPending} onClick={() => sauvegarde.mutate()}>Enregistrer</Button>
          <Button onClick={() => setConfirmation(false)} disabled={sauvegarde.isPending}>Revenir</Button>
        </div>
      </Dialog>
    </div>
  );
}

const pluralEtapes = (n: number) => `${n} étape${n > 1 ? 's' : ''} de validation`;

function describeStep(s: WorkflowStep) {
  const quand = s.condition === 'IF_PURPOSE' ? ` si ${(s.purposes ?? []).map((u) => (USAGES[u] ?? u).toLowerCase()).join(' ou ')}`
    : s.condition === 'IF_ESCALATED' ? ' sur demande' : '';
  return `${s.name || roleLabel(s.role)} (${roleLabel(s.role)})${quand}`;
}

interface EtapeProps {
  index: number;
  step: WorkflowStep;
  total: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<WorkflowStep>) => void;
  onMove: (step: number) => void;
  onRemove: () => void;
}

function Etape({ index: i, step: s, total, errors, onChange, onMove, onRemove }: EtapeProps) {
  const id = useId();
  const [autreRole, setAutreRole] = useState(!(s.role in ROLES));
  const err = (f: string) => errors[`steps[${i}].${f}`];
  const purposes = s.purposes ?? [];
  return (
    <li className="circuit-etape">
      <div className="etape-tete">
        <span className="etape-num num" aria-hidden="true">{i + 1}</span>
        <Field label={`Nom de l'étape ${i + 1}`} error={err('name')}>
          <input value={s.name} maxLength={100} aria-invalid={!!err('name')} placeholder="Validation du vice-doyen à la pédagogie"
            onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
      </div>
      <div className="grille-2">
        <Field label="Décidée par" error={err('role')}>
          <select value={autreRole ? '__autre' : s.role} onChange={(e) => {
            const autre = e.target.value === '__autre';
            setAutreRole(autre);
            onChange(autre ? { role: '', name: nameForRole(s, '') } : { role: e.target.value, name: nameForRole(s, e.target.value) });
          }}>
            {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            <option value="__autre">Autre rôle Keycloak…</option>
          </select>
        </Field>
        {autreRole && (
          <Field label="Rôle Keycloak" hint="Tel que défini dans le realm, ex. SECRETAIRE_GENERAL">
            <input value={s.role} aria-invalid={!!err('role')} onChange={(e) => onChange({ role: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} />
          </Field>
        )}
      </div>
      <fieldset className="conditions">
        <legend>S'applique</legend>
        {(Object.keys(CONDITIONS) as WorkflowCondition[]).map((c) => (
          <label key={c} className={`condition${s.condition === c ? ' choisie' : ''}`}>
            <input type="radio" name={`${id}-condition`} checked={s.condition === c} onChange={() => onChange({ condition: c })} />
            <span><strong>{CONDITIONS[c].label}</strong><span className="sous">{CONDITIONS[c].aide}</span></span>
          </label>
        ))}
      </fieldset>
      {s.condition === 'IF_PURPOSE' && (
        <fieldset className="usages">
          <legend>Usages concernés</legend>
          {USAGES_DECLARES.map(([k, l]) => (
            <label key={k}>
              <input type="checkbox" checked={purposes.includes(k)}
                onChange={(e) => onChange({ purposes: e.target.checked ? [...purposes, k] : purposes.filter((p) => p !== k) })} />{l}
            </label>
          ))}
          {err('purposes') && <p className="champ-erreur">{err('purposes')}</p>}
        </fieldset>
      )}
      <div className="etape-actions">
        <Button variant="quiet" disabled={i === 0} onClick={() => onMove(-1)} aria-label={`Monter l'étape ${i + 1}`}>Monter</Button>
        <Button variant="quiet" disabled={i === total - 1} onClick={() => onMove(1)} aria-label={`Descendre l'étape ${i + 1}`}>Descendre</Button>
        <Button variant="danger" onClick={onRemove} aria-label={`Retirer l'étape ${i + 1}`}>Retirer</Button>
      </div>
    </li>
  );
}

/** Essai du circuit en cours d'édition, avant de l'enregistrer. */
function Simulation({ steps }: { steps: WorkflowStep[] }) {
  const [usage, setUsage] = useState('');
  const [escalade, setEscalade] = useState(false);
  const parcours = useMemo(() => simulate(steps, usage, escalade), [steps, usage, escalade]);
  return (
    <section className="simulation" aria-labelledby="simulation-titre">
      <h2 id="simulation-titre">Essayer le circuit</h2>
      <Field label="Usage du document">
        <select value={usage} onChange={(e) => setUsage(e.target.value)}>
          {Object.entries(USAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <label className="case">
        <input type="checkbox" checked={escalade} onChange={(e) => setEscalade(e.target.checked)} />
        L'agent demande une validation supplémentaire
      </label>
      <ol className="parcours" aria-live="polite">
        <li>Établi</li>
        {parcours.map((s, i) => <li key={i}>{s.name.trim() || roleLabel(s.role)}<span className="sous">{roleLabel(s.role)}</span></li>)}
        <li className="parcours-cachet">Signé{parcours.length === 0 ? ' immédiatement' : ''}</li>
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------------------------- demandes en ligne

function DemandesEnLigne() {
  const api = useApi();
  const settings = useQuery({ queryKey: ['student-access'], queryFn: api.studentAccess });
  const status = useQuery({ queryKey: ['apogee-status'], queryFn: api.apogeeStatus, staleTime: Infinity });
  if (settings.isLoading) return <p className="champ-aide">Chargement…</p>;
  if (settings.isError) return <p className="erreur-chargement">Paramétrage indisponible : {(settings.error as Error).message}</p>;
  return (
    <div className="reglages-colonne">
      <p className="champ-aide">Ce que l'étudiant peut demander depuis l'application « Mes documents officiels » ou l'ENT.</p>
      {TYPES.map((t) => {
        const s = settings.data?.find((x) => x.type === t) ?? { type: t, mode: 'DISABLED', dailyLimit: 3 };
        return <AccesEtudiant key={`${t}-${s.mode}-${s.dailyLimit}`} setting={s as StudentAccessSetting} viewEnabled={!!status.data?.viewEnabled} />;
      })}
    </div>
  );
}

function AccesEtudiant({ setting, viewEnabled }: { setting: StudentAccessSetting; viewEnabled: boolean }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useId();
  const [mode, setMode] = useState<StudentAccessMode>(setting.mode!);
  const [limite, setLimite] = useState(String(setting.dailyLimit));
  const n = Number(limite);
  const limiteErreur = !Number.isInteger(n) || n < 1 || n > 50 ? 'Entre 1 et 50' : undefined;
  const dirty = mode !== setting.mode || n !== setting.dailyLimit;

  const sauvegarde = useMutation({
    mutationFn: () => api.saveStudentAccess(setting.type!, mode, n),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-access'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-config'] });
      toast({ message: `${DOCUMENT_LABELS[setting.type!]} : demande en ligne « ${MODES[mode].label.toLowerCase()} ».` });
    },
  });

  return (
    <section className="carte-reglage" aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`}>{DOCUMENT_LABELS[setting.type!]}</h2>
      <fieldset className={`conditions modes modes-${modesFor(setting.type!).length}`}>
        <legend className="sr">Demande en ligne</legend>
        {modesFor(setting.type!).map((m) => {
          const indisponible = m === 'AUTO' && !viewEnabled;
          return (
            <label key={m} className={`condition${mode === m ? ' choisie' : ''}${indisponible ? ' indisponible' : ''}`}>
              <input type="radio" name={`${id}-mode`} checked={mode === m} disabled={indisponible} onChange={() => setMode(m)} />
              <span><strong>{MODES[m].label}</strong>
                <span className="sous">{indisponible ? 'Nécessite la vue Oracle Apogée, qui n\'est pas activée sur ce serveur.' : MODES[m].aide}</span></span>
            </label>
          );
        })}
      </fieldset>
      {mode !== 'DISABLED' && (
        <div className="limite">
          <Field label="Demandes par jour et par étudiant" error={limiteErreur}>
            <input type="number" min={1} max={50} className="num" value={limite} aria-invalid={!!limiteErreur} onChange={(e) => setLimite(e.target.value)} />
          </Field>
        </div>
      )}
      {sauvegarde.isError && <p className="champ-erreur" role="alert">{(sauvegarde.error as Error).message}</p>}
      {dirty && (
        <div className="formulaire-actions">
          <Button variant="primary" busy={sauvegarde.isPending} disabled={!!limiteErreur} onClick={() => sauvegarde.mutate()}>Enregistrer</Button>
          <Button onClick={() => { setMode(setting.mode!); setLimite(String(setting.dailyLimit)); sauvegarde.reset(); }}>Annuler</Button>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------------- historique

const TYPES_PARAMETRAGE = ['WORKFLOW_UPDATED', 'STUDENT_ACCESS_UPDATED'];

function Historique() {
  const api = useApi();
  const [page, setPage] = useState(0);
  const events = useQuery({ queryKey: ['audit-config', page], queryFn: () => api.auditEvents(TYPES_PARAMETRAGE, page, 30) });
  if (events.isLoading) return <p className="champ-aide">Chargement…</p>;
  if (events.isError) return <p className="erreur-chargement">Historique indisponible : {(events.error as Error).message}</p>;
  const items = events.data?.items ?? [];
  return (
    <div className="reglages-colonne">
      {items.length === 0 ? (
        <div className="vide"><h2>Aucune modification</h2><p>Le paramétrage d'origine est en vigueur : signature immédiate, demandes en ligne fermées.</p></div>
      ) : (
        <ol className="journal">
          {items.map((e) => (
            <li key={e.id}>
              <span className="journal-quand num">{formatDateTime(e.createdAt)}</span>
              <span><strong>{e.eventType === 'WORKFLOW_UPDATED' ? 'Circuit de validation' : 'Demande en ligne'}</strong> · {e.actor}</span>
              <span className="journal-detail">{describeChange(e.eventType!, e.details, USAGES)}</span>
            </li>
          ))}
        </ol>
      )}
      {events.data!.totalPages! > 1 && (
        <nav className="pagination" aria-label="Pages">
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Plus récentes</Button>
          <span className="num">Page {page + 1} sur {events.data!.totalPages}</span>
          <Button disabled={page + 1 >= events.data!.totalPages!} onClick={() => setPage((p) => p + 1)}>Plus anciennes</Button>
        </nav>
      )}
    </div>
  );
}
