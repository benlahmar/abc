import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DocumentType, MyDocument, MyRequest, StudentProfile } from '@esign/api';
import { Feuille } from './components/Feuille';
import { useToast } from './components/Toasts';
import type { Source } from './source';
import { TYPES, USAGES, anneeCourante, anneesProposees, delai, demandesDuJour, doublon } from './lib/registre';

/** Secondes pendant lesquelles une demande peut être annulée (elle compte dans la limite du jour). */
export const DELAI_ENVOI = 5;
const SEMESTRES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

export interface Prerempli { type?: DocumentType; annee?: string; semestre?: string }

interface Props {
  source: Source;
  profil: StudentProfile;
  documents: MyDocument[];
  demandes: MyRequest[];
  prerempli: Prerempli;
  onFermer: () => void;
  onOuvrir: (cle: string) => void;
  onEnvoyee: (r: MyRequest) => Promise<void>;
}

const dateLongue = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export function Composer({ source, profil, documents, demandes, prerempli, onFermer, onOuvrir, onEnvoyee }: Props) {
  const toast = useToast();
  const offres = profil.documentTypes ?? [];
  const [type, setType] = useState<DocumentType | undefined>(() =>
    offres.some((o) => o.type === prerempli.type) ? prerempli.type : offres[0]?.type);
  const [annee, setAnnee] = useState(prerempli.annee ?? anneeCourante());
  const [semestre, setSemestre] = useState(prerempli.semestre ?? 'S1');
  const [usage, setUsage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const premier = useRef<HTMLInputElement>(null);
  useEffect(() => { premier.current?.focus(); }, []);

  if (!offres.length) {
    return (
      <div className="vide">
        <h3>Demande en ligne indisponible</h3>
        <p>La faculté ne propose pas de demande en ligne pour le moment. Adressez-vous au service de scolarité.</p>
        <button type="button" className="bouton" onClick={onFermer}>Revenir à mes documents</button>
      </div>
    );
  }

  const releve = type === 'RELEVE_NOTES';
  const offre = offres.find((o) => o.type === type);
  const reste = offre ? (offre.dailyLimit ?? 0) - demandesDuJour(demandes, offre.type!) : 0;
  const d = offre && delai(offre, annee);
  const deja = type && doublon(documents, demandes, { type, annee, semestre: releve ? semestre : null });

  /** Laisse quelques secondes pour annuler avant d'envoyer. */
  const envoyer = (ev: FormEvent) => {
    ev.preventDefault();
    setErreur(undefined);
    if (!type) { setErreur('Choisissez un document.'); return; }
    setEnvoi(true);
    const v = { type, academicYear: annee, semester: releve ? semestre : undefined, purpose: usage || undefined };
    const libelle = `${TYPES[type].titre} ${annee}${v.semester ? ` ${v.semester}` : ''}`;
    const minuteur = setTimeout(async () => {
      retirer();
      try {
        const r = await source.envoyer(v);
        if (r.status === 'FULFILLED' && r.documentId) toast('Document prêt : il est signé et téléchargeable.');
        else if (r.status === 'FAILED') toast(r.message, { erreur: true, duree: 9000 });
        else toast('Demande envoyée au service de scolarité.');
        await onEnvoyee(r);
      } catch (e) {
        setEnvoi(false);
        toast((e as Error).message, { erreur: true, duree: 9000 });
      }
    }, DELAI_ENVOI * 1000);
    const retirer = toast(<>{libelle} : envoi dans <Rebours depuis={DELAI_ENVOI} /> s</>, {
      duree: 0, action: { texte: 'Annuler l\'envoi', faire: () => { clearTimeout(minuteur); setEnvoi(false); toast('Envoi annulé.'); } },
    });
  };

  return (
    <>
      <button type="button" className="bouton retour" onClick={onFermer}>Retour à mes documents</button>
      <div className="composer">
        <form noValidate onSubmit={envoyer}>
          <div>
            <h3>Nouvelle demande</h3>
            <p className="indication">L'aperçu se met à jour au fil de vos choix.</p>
          </div>
          <fieldset>
            <legend>Document</legend>
            <div className="choix-type">
              {offres.map((o, i) => {
                const r = (o.dailyLimit ?? 0) - demandesDuJour(demandes, o.type!);
                return (
                  <label key={o.type}>
                    <input ref={i === 0 ? premier : undefined} type="radio" name="type" value={o.type} checked={type === o.type}
                      disabled={r <= 0} onChange={() => setType(o.type)} />
                    <span><strong>{TYPES[o.type!].titre}</strong></span>
                    <small>{r <= 0 ? 'Limite de demandes atteinte pour aujourd\'hui.' : TYPES[o.type!].aide}</small>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="champ"><span>Année universitaire</span>
            <select name="annee" value={annee} onChange={(e) => setAnnee(e.target.value)}>
              {anneesProposees().map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {releve && (
            <fieldset className="champ-semestre">
              <legend>Semestre</legend>
              <div className="semestres">
                {SEMESTRES.map((s) => (
                  <label key={s}>
                    <input type="radio" name="semestre" value={s} checked={semestre === s} aria-label={`Semestre ${s.slice(1)}`} onChange={() => setSemestre(s)} />
                    <span aria-hidden="true">{s}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className="champ"><span>À quoi servira le document ?</span>
            <select name="usage" value={usage} onChange={(e) => setUsage(e.target.value)}>
              {Object.entries(USAGES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            <p className="indication">Facultatif. Certains usages, comme un dossier pour l'étranger, peuvent demander une validation supplémentaire.</p>
          </label>
          <p className="message message-info">
            {!offre || reste <= 0 ? 'Toutes vos demandes du jour sont utilisées. Revenez demain.' : <>
              {d === 'inscription' ? 'Le document est produit immédiatement à partir de votre inscription.'
                : d === 'apogee' ? 'Le document est produit immédiatement à partir de vos données Apogée.'
                  : 'Votre demande est transmise au service de scolarité, qui établit le document.'}
              {` Il vous reste ${reste} demande${reste > 1 ? 's' : ''} aujourd'hui pour ce document.`}</>}
          </p>
          {deja?.nature === 'document' && (
            <div className="message message-info">Vous avez déjà ce document, signé le {dateLongue(deja.date)}.{' '}
              <button type="button" className="lien" onClick={() => onOuvrir(deja.cle)}>Ouvrir le document existant</button></div>
          )}
          {deja?.nature === 'demande' && (
            <div className="message message-info">Une demande identique est déjà en cours de traitement.{' '}
              <button type="button" className="lien" onClick={() => onOuvrir(deja.cle)}>Voir son avancement</button></div>
          )}
          {erreur && <p className="erreur-champ" role="alert">{erreur}</p>}
          <div className="composer-actions">
            <button type="submit" className="bouton bouton-principal" disabled={envoi || !offre || reste <= 0}>Envoyer la demande</button>
            <button type="button" className="bouton" onClick={onFermer}>Annuler</button>
          </div>
        </form>
        {type && <Feuille type={type} annee={annee} semestre={releve ? semestre : null} statut="PENDING" brouillon
          etudiant={{ nom: profil.name, cne: profil.cne }} />}
      </div>
    </>
  );
}

/** Secondes restantes, affichées dans la notification d'envoi. */
function Rebours({ depuis }: { depuis: number }) {
  const [n, setN] = useState(depuis);
  useEffect(() => {
    const t = setInterval(() => setN((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="toast-compte">{n}</span>;
}
