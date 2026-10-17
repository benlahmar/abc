import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type RegistryFiliereDiff, type RegistryPerson, type RegistryReport, type RegistryStudent } from '@esign/api';
import { useAuth } from '@esign/auth';
import { Button, Dialog, Field, Status, formatDate, formatDateTime, relativeTime, useToast } from '@esign/ui';
import { useApi } from '../api';
import { useHotkeys } from '../lib/keys';
import { Depot } from '../components/Depot';
import { annees, resumeFiliere, totaux } from '../lib/registre';
import { pluriel } from '../lib/imports';

type Panneau = { vue: 'filiere'; filiere: string | null } | { vue: 'import' };

export function RegistreSection() {
  const api = useApi();
  const { hasRole } = useAuth();
  const agent = hasRole('AGENT_SCOLARITE');
  const admin = hasRole('ESIGN_ADMIN');
  const [annee, setAnnee] = useState<string>();
  const [panneau, setPanneau] = useState<Panneau>({ vue: 'filiere', filiere: null });
  const [purge, setPurge] = useState(false);

  const vue = useQuery({ queryKey: ['registry', annee ?? 'courante'], queryFn: () => api.registry(annee) });
  const courante = vue.data?.currentAcademicYear;
  const year = annee ?? vue.data?.academicYear;
  const filieres = vue.data?.filieres ?? [];
  const total = filieres.reduce((s, f) => s + (f.students ?? 0), 0);
  const bloques = filieres.reduce((s, f) => s + (f.blocked ?? 0), 0);
  useHotkeys({ n: () => agent && setPanneau({ vue: 'import' }) }, panneau.vue !== 'import');

  return (
    <div className="section">
      <header className="section-tete">
        <h1>Registre des inscrits</h1>
        {courante && (
          <label className="annee">
            <span className="sr">Année universitaire</span>
            <select value={year} onChange={(e) => { setAnnee(e.target.value); setPanneau({ vue: 'filiere', filiere: null }); }}>
              {annees(courante).map((a) => <option key={a} value={a}>{a}{a === courante ? ' (en cours)' : ''}</option>)}
            </select>
          </label>
        )}
        <p className="section-aide">Sert à délivrer aussitôt les attestations demandées en ligne, si le mode « Immédiate depuis le registre » est activé.</p>
        {agent && <Button variant="primary" onClick={() => setPanneau({ vue: 'import' })}>Importer une liste <kbd>N</kbd></Button>}
      </header>

      {year && courante && year !== courante && (
        <div className="lot bandeau-annee">
          <span>Année {year} : ces listes ne servent plus qu'aux demandes portant sur cette année.</span>
          {admin && <Button variant="danger" onClick={() => setPurge(true)}>Supprimer les listes de {year}…</Button>}
        </div>
      )}

      <div className={`espace${panneau.vue === 'import' ? ' espace-large' : ' espace-registre'}`}>
        <div className="tableau-zone" aria-busy={vue.isFetching}>
          {vue.isError && <p className="erreur-chargement">Registre indisponible : {(vue.error as Error).message} <Button onClick={() => void vue.refetch()}>Réessayer</Button></p>}
          {vue.isLoading && <div className="squelettes">{[0, 1, 2].map((i) => <div key={i} className="squelette" />)}</div>}
          {vue.data && filieres.length === 0 && (
            <div className="vide">
              <h2>Aucune liste pour {year}</h2>
              <p>Importez la liste des inscrits de chaque filière (CNE, nom, prénom, filière, niveau ; date et lieu de naissance
                facultatifs). Tant qu'un étudiant n'y figure pas, ses demandes d'attestation vont au service.</p>
              {agent && (
                <div className="actions-ligne">
                  <Button variant="primary" onClick={() => setPanneau({ vue: 'import' })}>Importer une liste</Button>
                  <a className="btn" href="/modele-registre-inscrits.csv" download>Modèle de fichier</a>
                </div>
              )}
            </div>
          )}
          {filieres.length > 0 && (
            <table className="tableau">
              <thead><tr><th scope="col">Filière</th><th scope="col" className="num">Inscrits</th><th scope="col">Dernier import</th></tr></thead>
              <tbody>
                {filieres.map((f) => (
                  <tr key={f.filiere} aria-selected={panneau.vue === 'filiere' && panneau.filiere === f.filiere}
                    onClick={() => setPanneau({ vue: 'filiere', filiere: f.filiere! })}>
                    <td><strong>{f.filiere}</strong>{(f.blocked ?? 0) > 0 && <span className="etiquette etiquette-alerte">{pluriel(f.blocked!, 'bloqué')}</span>}</td>
                    <td className="num">{f.students?.toLocaleString('fr-FR')}</td>
                    <td>{f.lastImport ? <><span title={formatDateTime(f.lastImport.importedAt)}>{relativeTime(f.lastImport.importedAt)}</span>
                      <span className="sous">{f.lastImport.importedByName} · +{f.lastImport.added} −{f.lastImport.removed}{f.lastImport.changed ? ` ~${f.lastImport.changed}` : ''}</span></> : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total{bloques > 0 ? `, dont ${pluriel(bloques, 'bloqué')}` : ''}</td><td className="num">{total.toLocaleString('fr-FR')}</td><td /></tr>
              </tfoot>
            </table>
          )}
        </div>

        <aside className="panneau" aria-label={panneau.vue === 'import' ? 'Importer une liste' : 'Étudiants inscrits'}>
          {year && (panneau.vue === 'import'
            ? <NouvelImport year={year} onCancel={() => setPanneau({ vue: 'filiere', filiere: null })}
                onDone={(f) => setPanneau({ vue: 'filiere', filiere: f })} />
            : <Etudiants key={`${year}-${panneau.filiere}`} year={year} filiere={panneau.filiere} peutBloquer={agent} />)}
        </aside>
      </div>

      {year && <Purge open={purge} year={year} onClose={() => setPurge(false)} onDone={() => { setPurge(false); setAnnee(courante); }} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------- import

function NouvelImport({ year, onCancel, onDone }: { year: string; onCancel: () => void; onDone: (filiere: string | null) => void }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [rapport, setRapport] = useState<RegistryReport>();
  const [confirmation, setConfirmation] = useState(false);

  const verification = useMutation({ mutationFn: () => api.checkRegistry(file!, year), onSuccess: setRapport });
  const application = useMutation({
    mutationFn: () => api.importRegistry(file!, year),
    onSuccess: (r) => {
      setConfirmation(false);
      void queryClient.invalidateQueries({ queryKey: ['registry'] });
      void queryClient.invalidateQueries({ queryKey: ['registry-students'] });
      const t = totaux(r);
      toast({ message: `Registre ${year} mis à jour : ${pluriel(t.filieres, 'filière')}, ${pluriel(r.students ?? 0, 'inscrit')}.` });
      onDone(r.filieres?.length === 1 ? r.filieres[0].filiere! : null);
    },
  });
  const t = rapport && totaux(rapport);

  return (
    <>
      <h2>Importer une liste d'inscrits, {year}</h2>
      <ol className="etapes" aria-label="Étapes">
        <li aria-current={!rapport ? 'step' : undefined}>Fichier</li>
        <li aria-current={rapport ? 'step' : undefined}>Vérification</li>
        <li>Remplacement</li>
      </ol>
      <div className="formulaire">
        <div>
          <Depot file={file} invitation="Déposez la liste des inscrits ici" error={fileError} onError={setFileError}
            onFile={(f) => { setFile(f); setRapport(undefined); verification.reset(); }} />
          <p className="champ-aide">Une ligne par étudiant. Pour chaque filière présente dans le fichier, la liste <strong>remplace</strong> celle
            de {year} : un étudiant absent n'obtient plus d'attestation immédiate. <a href="/modele-registre-inscrits.csv" download>Télécharger le modèle</a></p>
        </div>
        {verification.isError && <p className="formulaire-message erreur" role="alert">{(verification.error as Error).message}</p>}
        {!rapport && (
          <div className="formulaire-actions">
            <Button variant="primary" busy={verification.isPending} onClick={() => file ? verification.mutate() : setFileError('Choisissez d\'abord un fichier.')}>
              Vérifier la liste</Button>
            <Button onClick={onCancel}>Annuler</Button>
          </div>
        )}
      </div>

      {rapport && t && (
        <section className="rapport" aria-label="Résultat de la vérification">
          <dl className="compteurs">
            <div><dt>Lignes lues</dt><dd className="num">{rapport.rows}</dd></div>
            <div><dt>Filières</dt><dd className="num">{t.filieres}</dd></div>
            <div className="ok"><dt>Arrivées</dt><dd className="num">{t.arrivees}</dd></div>
            <div className={t.departs ? 'ko' : ''}><dt>Départs</dt><dd className="num">{t.departs}</dd></div>
          </dl>

          {t.erreurs > 0 && (
            <>
              <h3>Lignes à corriger</h3>
              <p className="encart encart-ko">L'import est bloqué tant qu'une ligne est en erreur : une liste incomplète retirerait
                des étudiants du registre.</p>
              <ul className="problemes">
                {rapport.problems!.slice(0, 30).map((p) => (
                  <li key={p.line}><div><strong className="num">Ligne {p.line}</strong> {p.cne && <span className="sous-ligne num">{p.cne}</span>}</div>
                    <ul>{p.errors?.map((e) => <li key={e}>{e}</li>)}</ul></li>
                ))}
              </ul>
              {rapport.problems!.length > 30 && <p className="champ-aide">Et {rapport.problems!.length - 30} autres lignes.</p>}
            </>
          )}

          <h3>Changements par filière</h3>
          {rapport.filieres?.map((d) => <DiffFiliere key={d.filiere} d={d} />)}
        </section>
      )}

      {rapport && t && (
        <div className="formulaire-actions">
          <Button variant="primary" disabled={t.erreurs > 0} onClick={() => setConfirmation(true)}>
            Remplacer {t.filieres > 1 ? `les listes de ${t.filieres} filières` : 'la liste'}</Button>
          <Button onClick={() => { setRapport(undefined); setFile(undefined); }}>Autre fichier</Button>
          <Button variant="quiet" onClick={onCancel}>Abandonner</Button>
        </div>
      )}

      <Dialog open={confirmation} title="Remplacer les listes ?" onClose={() => setConfirmation(false)}>
        <p>{rapport?.filieres?.map((d) => d.filiere).join(', ')} : {pluriel(rapport?.students ?? 0, 'inscrit')} pour {year}.</p>
        {t && t.departs > 0 && <p className="encart encart-ko">{pluriel(t.departs, 'étudiant')} {t.departs > 1 ? 'quittent' : 'quitte'} le registre :
          {t.departs > 1 ? ' leurs' : ' ses'} demandes d'attestation iront désormais au service.</p>}
        {application.isError && <p className="champ-erreur" role="alert">{(application.error as Error).message}</p>}
        <div className="formulaire-actions">
          <Button variant="primary" busy={application.isPending} onClick={() => application.mutate()}>Remplacer</Button>
          <Button onClick={() => setConfirmation(false)} disabled={application.isPending}>Revenir</Button>
        </div>
      </Dialog>
    </>
  );
}

function DiffFiliere({ d }: { d: RegistryFiliereDiff }) {
  const liste = (titre: string, people: RegistryPerson[] = [], count = 0, ton: string) => count > 0 && (
    <details className={`diff diff-${ton}`}>
      <summary>{titre} <span className="num">({count})</span></summary>
      <ul>
        {people.map((p) => <li key={p.cne}><span className="num">{p.cne}</span> {p.prenom} {p.nom} <span className="sous-ligne">{p.niveau}{p.detail ? ` · ${p.detail}` : ''}</span></li>)}
        {count > people.length && <li className="sous-ligne">… et {count - people.length} autres</li>}
      </ul>
    </details>
  );
  return (
    <div className="carte-diff">
      <strong>{d.filiere}</strong> <span className="sous-ligne">{resumeFiliere(d)}</span>
      {liste('Arrivées', d.added, d.addedCount, 'ok')}
      {liste('Départs', d.removed, d.removedCount, 'ko')}
      {liste('Changements', d.changed, d.changedCount, 'attente')}
    </div>
  );
}

// ------------------------------------------------------------------------------------- étudiants

function Etudiants({ year, filiere, peutBloquer }: { year: string; filiere: string | null; peutBloquer: boolean }) {
  const api = useApi();
  const [q, setQ] = useState('');
  const [recherche, setRecherche] = useState('');
  const [bloquesSeuls, setBloquesSeuls] = useState(false);
  const [page, setPage] = useState(0);
  const [blocage, setBlocage] = useState<RegistryStudent>();
  useEffect(() => { const t = setTimeout(() => { setRecherche(q.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);
  const query = { academicYear: year, filiere: filiere ?? undefined, q: recherche || undefined, blocked: bloquesSeuls, page, size: 50 };
  const liste = useQuery({ queryKey: ['registry-students', query], queryFn: () => api.registryStudents(query), placeholderData: keepPreviousData });
  const items = liste.data?.items ?? [];

  return (
    <>
      <h2>{filiere ?? 'Toutes les filières'}</h2>
      <div className="outils-panneau">
        <label className="recherche"><span className="sr">Rechercher un étudiant</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="CNE ou nom" /></label>
        <label className="case"><input type="checkbox" checked={bloquesSeuls} onChange={(e) => { setBloquesSeuls(e.target.checked); setPage(0); }} />Bloqués seulement</label>
      </div>
      <p className="champ-aide" aria-live="polite">{liste.data ? pluriel(liste.data.total ?? 0, 'étudiant') : 'Chargement…'}</p>
      <ul className="inscrits">
        {items.map((s) => (
          <li key={s.id} className={s.blocked ? 'bloque' : ''}>
            <div className="inscrits-tete">
              <span><strong>{s.nom} {s.prenom}</strong> <span className="sous-ligne num">{s.cne}</span></span>
              {peutBloquer && (s.blocked
                ? <Debloquer s={s} />
                : <Button variant="quiet" onClick={() => setBlocage(s)}>Bloquer…</Button>)}
            </div>
            <span className="sous">{!filiere && `${s.filiere} · `}{s.niveau}{s.dateNaissance ? ` · né(e) le ${formatDate(s.dateNaissance)}` : ''}</span>
            {s.blocked && <span className="inscrits-blocage"><Status tone="ko">Bloqué</Status> {s.blockedReason} <span className="sous-ligne">({s.blockedBy}, {formatDateTime(s.blockedAt)})</span></span>}
          </li>
        ))}
      </ul>
      {liste.data && (liste.data.totalPages ?? 0) > 1 && (
        <nav className="pagination" aria-label="Pages">
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédents</Button>
          <span className="num">{page + 1} / {liste.data.totalPages}</span>
          <Button disabled={page + 1 >= liste.data.totalPages!} onClick={() => setPage((p) => p + 1)}>Suivants</Button>
        </nav>
      )}
      {blocage && <Blocage s={blocage} onClose={() => setBlocage(undefined)} />}
    </>
  );
}

const MOTIFS_BLOCAGE = ['Transfert en cours', 'Inscription annulée', 'Dossier administratif incomplet', 'Situation à vérifier par le service'];

function Blocage({ s, onClose }: { s: RegistryStudent; onClose: () => void }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [motif, setMotif] = useState('');
  const bloquer = useMutation({
    mutationFn: () => api.blockStudent(s.id!, motif.trim()),
    onSuccess: () => {
      ['registry', 'registry-students'].forEach((k) => void queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ message: `${s.prenom} ${s.nom} est bloqué(e) : ses demandes d'attestation iront au service.` });
      onClose();
    },
  });
  return (
    <Dialog open title={`Bloquer ${s.prenom} ${s.nom} ?`} onClose={onClose}>
      <p>Ses demandes d'attestation en ligne iront au service, même s'il figure dans la liste. Le blocage reste en place après les imports suivants.</p>
      <div className="motifs">{MOTIFS_BLOCAGE.map((m) => <button key={m} type="button" className="motif" onClick={() => setMotif(m)}>{m}</button>)}</div>
      <Field label="Motif (visible des agents)" error={bloquer.isError ? (bloquer.error as Error).message : undefined}>
        <input value={motif} maxLength={500} onChange={(e) => setMotif(e.target.value)} />
      </Field>
      <div className="formulaire-actions">
        <Button variant="danger-plein" disabled={!motif.trim()} busy={bloquer.isPending} onClick={() => bloquer.mutate()}>Bloquer</Button>
        <Button onClick={onClose}>Annuler</Button>
      </div>
    </Dialog>
  );
}

function Debloquer({ s }: { s: RegistryStudent }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const debloquer = useMutation({
    mutationFn: () => api.unblockStudent(s.id!),
    onSuccess: () => {
      ['registry', 'registry-students'].forEach((k) => void queryClient.invalidateQueries({ queryKey: [k] }));
      toast({ message: `${s.prenom} ${s.nom} est débloqué(e).` });
    },
  });
  return <Button variant="quiet" busy={debloquer.isPending} onClick={() => debloquer.mutate()}>Débloquer</Button>;
}

function Purge({ open, year, onClose, onDone }: { open: boolean; year: string; onClose: () => void; onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const queryClient = useQueryClient();
  const purge = useMutation({
    mutationFn: () => api.purgeRegistry(year),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['registry'] });
      toast({ message: `Listes ${year} supprimées (${pluriel(r.removed, 'inscrit')}).` });
      onDone();
    },
  });
  return (
    <Dialog open={open} title={`Supprimer les listes de ${year} ?`} onClose={onClose}>
      <p>Les données personnelles des inscrits de {year} sont effacées. Les attestations déjà délivrées restent valables ; les
        nouvelles demandes portant sur {year} iront au service.</p>
      {purge.isError && <p className="champ-erreur" role="alert">{(purge.error as Error).message}</p>}
      <div className="formulaire-actions">
        <Button variant="danger-plein" busy={purge.isPending} onClick={() => purge.mutate()}>Supprimer définitivement</Button>
        <Button onClick={onClose}>Annuler</Button>
      </div>
    </Dialog>
  );
}
