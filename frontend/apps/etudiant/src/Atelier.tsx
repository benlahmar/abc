import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MyDocument, MyRequest, StudentProfile } from '@esign/api';
import { Feuille } from './components/Feuille';
import { useToast } from './components/Toasts';
import { Composer, type Prerempli } from './Composer';
import type { Source } from './source';
import { ETATS, TYPES, correspond, entrees, type Entree, type Filtre } from './lib/registre';

const dateLongue = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const dateHeure = (iso?: string) => iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
/** Événement d'ouverture de l'aide (lien « Raccourcis » de l'en-tête). */
export const AIDE = 'esign:aide';

const etroit = () => matchMedia('(max-width: 760px)').matches;

const FILTRES: [Filtre, string][] = [['tout', 'Tout'], ['prets', 'Prêts'], ['cours', 'En cours'], ['clos', 'Refusés ou annulés']];

export function Atelier({ source, profil }: { source: Source; profil: StudentProfile }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const documents = useQuery({ queryKey: ['mes-documents'], queryFn: source.documents });
  const demandes = useQuery({ queryKey: ['mes-demandes'], queryFn: source.demandes });
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [recherche, setRecherche] = useState('');
  const [selection, setSelection] = useState<string | null>(null);
  const [mode, setMode] = useState<'vue' | 'demande'>('vue');
  const [prerempli, setPrerempli] = useState<Prerempli>({});
  // Sur écran étroit : la liste, ou le document (consultation)
  const [consultation, setConsultation] = useState(() => !etroit());
  const [aide, setAide] = useState(false);
  const cachetsPoses = useRef(new Set<string>());
  const champRecherche = useRef<HTMLInputElement>(null);
  const plan = useRef<HTMLElement>(null);

  const docs = useMemo(() => documents.data ?? [], [documents.data]);
  const dems = useMemo(() => demandes.data ?? [], [demandes.data]);
  const toutes = useMemo(() => entrees(docs, dems), [docs, dems]);
  const visibles = toutes.filter((e) => correspond(e, filtre, recherche));
  const chargee = documents.isSuccess && demandes.isSuccess;

  // À l'ouverture : le document prêt le plus récent, sinon l'élément le plus récent
  useEffect(() => {
    if (chargee && selection === null && toutes.length) setSelection((toutes.find((e) => e.statut === 'SIGNED') ?? toutes[0]).cle);
  }, [chargee, selection, toutes]);

  const choisir = useCallback((cle: string, depuisClic = false) => {
    setSelection(cle);
    setMode('vue');
    setConsultation(true);
    if (depuisClic && etroit()) plan.current?.focus();
  }, []);
  const ouvrirDemande = useCallback((p: Prerempli = {}) => { setPrerempli(p); setMode('demande'); setConsultation(true); }, []);
  const fermerDemande = useCallback(() => { setMode('vue'); setConsultation(!etroit()); }, []);
  const recharger = useCallback(async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['mes-documents'] }), queryClient.invalidateQueries({ queryKey: ['mes-demandes'] })]);
  }, [queryClient]);

  const telecharger = useCallback(async (doc: MyDocument) => {
    try {
      const pdf = await source.telecharger(doc);
      if (!pdf) { toast('Mode démonstration : le PDF signé serait téléchargé ici.'); return; }
      const url = URL.createObjectURL(pdf);
      Object.assign(document.createElement('a'), { href: url, download: `${doc.type!.toLowerCase()}-${doc.academicYear}${doc.semester ? `-${doc.semester}` : ''}.pdf` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Document téléchargé.');
    } catch (e) {
      toast((e as Error).message, { erreur: true });
    }
  }, [source, toast]);

  const courante = toutes.find((e) => e.cle === selection) ?? toutes[0];
  // Le cachet se pose une seule fois par document, à sa première apparition
  useEffect(() => { if (courante?.ref) cachetsPoses.current.add(courante.ref); }, [courante?.ref]);

  useEffect(() => {
    const ouvrir = () => setAide(true);
    window.addEventListener(AIDE, ouvrir);
    return () => window.removeEventListener(AIDE, ouvrir);
  }, []);

  // Raccourcis clavier (hors saisie et hors boîte de dialogue)
  useEffect(() => {
    const touche = (ev: KeyboardEvent) => {
      const saisie = (ev.target as HTMLElement).closest('input, select, textarea');
      if (ev.key === 'Escape' && mode === 'demande') { fermerDemande(); return; }
      if (saisie || ev.ctrlKey || ev.metaKey || ev.altKey || aide) return;
      if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); ouvrirDemande(); }
      else if (ev.key === '/') { ev.preventDefault(); champRecherche.current?.focus(); }
      else if (ev.key === '?') { ev.preventDefault(); setAide(true); }
      else if ((ev.key === 't' || ev.key === 'T') && mode === 'vue' && courante?.nature === 'document' && courante.statut === 'SIGNED') {
        ev.preventDefault(); void telecharger(courante.doc);
      } else if ((ev.target as HTMLElement).id === 'liste' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        ev.preventDefault();
        const i = visibles.findIndex((e) => e.cle === selection);
        const suivante = visibles[Math.min(visibles.length - 1, Math.max(0, i + (ev.key === 'ArrowDown' ? 1 : -1)))];
        if (suivante) { choisir(suivante.cle); document.getElementById(`l-${suivante.cle.replace(':', '-')}`)?.scrollIntoView({ block: 'nearest' }); }
      }
    };
    document.addEventListener('keydown', touche);
    return () => document.removeEventListener('keydown', touche);
  }, [mode, aide, courante, visibles, selection, choisir, ouvrirDemande, fermerDemande, telecharger]);

  const reinitialiser = () => { setFiltre('tout'); setRecherche(''); };
  const compte = (g: Filtre) => toutes.filter((e) => ETATS[e.statut].groupe === g).length;

  let anneeAffichee: string | null = null;
  return (
    <div className={`atelier${consultation ? ' consultation' : ''}`}>
      <section className="registre" aria-labelledby="registre-titre">
        <div className="registre-tete">
          <h2 id="registre-titre">Mes documents</h2>
          <button type="button" className="bouton bouton-principal" aria-keyshortcuts="n" onClick={() => ouvrirDemande()}>Nouvelle demande</button>
        </div>
        <div className="registre-outils">
          <label className="recherche">
            <span className="sr">Rechercher</span>
            <input ref={champRecherche} type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher : relevé, 2024, S5, référence…" aria-keyshortcuts="/" />
          </label>
          <div className="filtres" role="radiogroup" aria-label="Afficher">
            {FILTRES.map(([f, texte]) => (
              <button key={f} type="button" role="radio" className="filtre" aria-checked={filtre === f} onClick={() => setFiltre(f)}>
                {texte}{(f === 'prets' || f === 'cours') && chargee && <span className="compte"> ({compte(f)})</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="registre-liste" id="liste" role="listbox" aria-label="Documents et demandes" tabIndex={0} aria-busy={!chargee}
          aria-activedescendant={selection ? `l-${selection.replace(':', '-')}` : undefined}>
          {!chargee && !(documents.isError || demandes.isError) && <div className="squelette" aria-hidden="true"><i /><i /><i /><i /></div>}
          {(documents.isError || demandes.isError) && (
            <p className="vide-liste">Vos documents n'ont pas pu être chargés. <button type="button" className="lien" onClick={() => void recharger()}>Réessayer</button></p>
          )}
          {chargee && !toutes.length && <p className="vide-liste">Vous n'avez encore aucun document.</p>}
          {chargee && toutes.length > 0 && !visibles.length && (
            <p className="vide-liste">Aucun document ne correspond. <button type="button" className="lien" onClick={reinitialiser}>Tout afficher</button></p>
          )}
          {visibles.map((e) => {
            const titreAnnee = e.annee !== anneeAffichee ? (anneeAffichee = e.annee) : null;
            const info = ETATS[e.statut];
            const signe = e.nature === 'document' && e.doc.signedAt;
            const detail = [e.semestre ? `Semestre ${e.semestre.slice(1)}` : null,
              signe ? `signé le ${dateLongue(e.doc.signedAt)}` : `demandé le ${dateLongue(e.date)}`].filter(Boolean).join(', ');
            return (
              <div key={e.cle} role="presentation">
                {titreAnnee && <div className="annee" role="presentation">Année {titreAnnee}</div>}
                <div className="ligne" role="option" id={`l-${e.cle.replace(':', '-')}`} aria-selected={e.cle === selection && mode === 'vue'}
                  onClick={() => choisir(e.cle, true)}>
                  <span className="ligne-titre">{TYPES[e.type].titre}</span>
                  <span className={`etat etat-${info.classe}`}>{info.texte}</span>
                  <span className="ligne-detail">{detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="plan" id="feuille" ref={plan} tabIndex={-1} aria-live="polite">
        {mode === 'demande' ? (
          <Composer source={source} profil={profil} documents={docs} demandes={dems} prerempli={prerempli}
            onFermer={fermerDemande} onOuvrir={choisir}
            onEnvoyee={async (r) => {
              await recharger();
              if (r.status === 'FULFILLED' && r.documentId) choisir(`doc:${r.documentId}`);
              else choisir(`dem:${r.id}`);
            }} />
        ) : !chargee ? null : !courante ? (
          <div className="vide">
            <h3>Votre première demande</h3>
            <p>Choisissez une attestation de scolarité ou un relevé de notes. Vous suivrez ici son traitement, puis vous téléchargerez le document signé.</p>
            <button type="button" className="bouton bouton-principal" onClick={() => ouvrirDemande()}>Faire une demande</button>
          </div>
        ) : (
          <>
            <button type="button" className="bouton retour" onClick={() => setConsultation(false)}>Retour à mes documents</button>
            <div className="plan-vue">
              <Feuille type={courante.type} annee={courante.annee} semestre={courante.semestre} reference={courante.ref} statut={courante.statut}
                brouillon={courante.nature === 'demande'} etudiant={{ nom: profil.name, cne: profil.cne }}
                poser={!!courante.ref && !cachetsPoses.current.has(courante.ref)} />
              <Fiche e={courante} onTelecharger={telecharger} onRedemander={(p) => ouvrirDemande(p)} />
            </div>
          </>
        )}
      </section>

      <Aide ouverte={aide} onFermer={() => setAide(false)} />
    </div>
  );
}

function Fiche({ e, onTelecharger, onRedemander }: { e: Entree; onTelecharger: (d: MyDocument) => void; onRedemander: (p: Prerempli) => void }) {
  const toast = useToast();
  const info = ETATS[e.statut];
  const redemander = () => onRedemander({ type: e.type, annee: e.annee, semestre: e.semestre });
  const copier = async (doc: MyDocument) => {
    try { await navigator.clipboard.writeText(doc.verificationUrl!); toast('Lien de vérification copié.'); }
    catch { toast('Copie impossible : sélectionnez le lien sur la page de vérification.', { erreur: true }); }
  };
  return (
    <aside className="fiche" aria-label="Informations et actions">
      <div>
        <h3>{TYPES[e.type].titre}{e.semestre ? `, semestre ${e.semestre.slice(1)}` : ''}</h3>
        <div className={`fiche-etat etat etat-${info.classe}`}>{info.texte}</div>
      </div>
      {e.nature === 'document' && e.statut === 'SIGNED' && (
        <>
          <p>Signé électroniquement par la faculté le {dateLongue(e.doc.signedAt)}. Toute modification du fichier invalide la signature.</p>
          <div className="fiche-actions">
            <button type="button" className="bouton bouton-principal" aria-keyshortcuts="t" onClick={() => onTelecharger(e.doc)}>Télécharger le PDF signé</button>
            <button type="button" className="bouton" onClick={() => void copier(e.doc)}>Copier le lien de vérification</button>
            {e.doc.verificationUrl && <a className="bouton" href={e.doc.verificationUrl} target="_blank" rel="noopener">Voir la page de vérification</a>}
          </div>
          <p>Transmettez le lien de vérification avec le document : l'organisme destinataire contrôle lui-même son authenticité.</p>
        </>
      )}
      {e.nature === 'document' && e.statut === 'REVOKED' && (
        <>
          <div className="message">La faculté a annulé ce document le {dateLongue(e.doc.revokedAt)}{e.doc.revocationReason ? ` : ${e.doc.revocationReason}` : '.'}</div>
          <p>Il n'a plus de valeur. Si vous en avez besoin, faites une nouvelle demande.</p>
          <button type="button" className="bouton" onClick={redemander}>Demander à nouveau</button>
        </>
      )}
      {e.statut === 'PENDING_APPROVAL' && <p>Le document est établi et attend une validation avant d'être signé. Il apparaîtra comme prêt dès sa signature.</p>}
      {e.nature === 'demande' && (
        <>
          <Suivi d={e.demande} />
          {(e.statut === 'REJECTED' || e.statut === 'FAILED') && <button type="button" className="bouton" onClick={redemander}>Corriger et redemander</button>}
        </>
      )}
    </aside>
  );
}

/** Les étapes d'une demande, dans l'ordre. */
function Suivi({ d }: { d: MyRequest }) {
  return (
    <div>
      <ol className="suivi">
        <li className="fait"><strong>Demande envoyée</strong><span>{dateHeure(d.createdAt)}</span></li>
        {d.status === 'PENDING' ? (
          <>
            <li className="encours"><strong>Traitement par le service de scolarité</strong><span>En cours</span></li>
            <li><strong>Signature et mise à disposition</strong><span>À venir</span></li>
          </>
        ) : (
          <li className="echec"><strong>{d.status === 'REJECTED' ? 'Demande refusée' : 'Production impossible'}</strong><span>{dateHeure(d.handledAt)}</span></li>
        )}
      </ol>
      {d.message && <div className="message">{d.message}</div>}
    </div>
  );
}

function Aide({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (ouverte && d && !d.open) d.showModal();
    if (!ouverte && d?.open) d.close();
  }, [ouverte]);
  return (
    <dialog className="aide" ref={ref} aria-labelledby="aide-titre" onClose={onFermer}>
      <h2 id="aide-titre">Raccourcis clavier</h2>
      <dl>
        <dt><kbd>N</kbd></dt><dd>Nouvelle demande</dd>
        <dt><kbd>/</kbd></dt><dd>Rechercher dans mes documents</dd>
        <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Parcourir la liste</dd>
        <dt><kbd>T</kbd></dt><dd>Télécharger le document affiché</dd>
        <dt><kbd>Échap</kbd></dt><dd>Fermer la demande en cours</dd>
        <dt><kbd>?</kbd></dt><dd>Afficher cette aide</dd>
      </dl>
      <form method="dialog"><button className="bouton">Fermer</button></form>
    </dialog>
  );
}
