import { useId } from 'react';
import type { DocumentType } from '@esign/api';
import { useConfig } from '../config';
import { TYPES, type Statut } from '../lib/registre';

type TypeCachet = 'signe' | 'attente' | 'annule';

/** Le cachet : seul élément animé de l'interface, il se pose quand un document signé est affiché. */
export function Cachet({ type, poser }: { type: TypeCachet; poser: boolean }) {
  const config = useConfig();
  const id = useId().replace(/:/g, '');
  const [haut, bas] = { signe: ['SIGNÉ', 'électroniquement'], attente: ['EN ATTENTE', 'de signature'], annule: ['ANNULÉ', 'par la faculté'] }[type];
  // Texte circulaire du tampon : faculté et ville, comme sur un cachet réel
  const pourtour = [config.faculty, config.city].filter(Boolean).join(' · ').toUpperCase();
  const pointille = type === 'attente' ? '5 6' : undefined;
  return (
    <div className={`cachet cachet-${type}${poser ? ' cachet-pose' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <defs>
          <filter id={`encre-${id}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={7} />
            <feDisplacementMap in="SourceGraphic" scale={2.4} />
          </filter>
          <path id={`arc-${id}`} d="M 100,100 m -72,0 a 72,72 0 1,1 144,0 a 72,72 0 1,1 -144,0" />
        </defs>
        <g filter={`url(#encre-${id})`} fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="94" strokeWidth="5" strokeDasharray={pointille} />
          <circle cx="100" cy="100" r="58" strokeWidth="2" strokeDasharray={pointille} />
          <text fill="currentColor" stroke="none" fontFamily="Atkinson Hyperlegible, sans-serif" fontSize="13" fontWeight="700" letterSpacing="1.2">
            <textPath href={`#arc-${id}`} startOffset="50%" textAnchor="middle" textLength={440} lengthAdjust="spacing">{pourtour}</textPath>
          </text>
          <text x="100" y="100" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Atkinson Hyperlegible, sans-serif"
            fontSize={type === 'attente' ? 17 : 22} fontWeight="700">{haut}</text>
          <text x="100" y="120" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Spectral, serif" fontStyle="italic" fontSize="14">{bas}</text>
        </g>
      </svg>
    </div>
  );
}

interface FeuilleProps {
  type: DocumentType;
  annee: string;
  semestre?: string | null;
  reference?: string;
  statut: Statut;
  brouillon?: boolean;
  /** Animation du cachet (une seule fois par document). */
  poser?: boolean;
  etudiant: { nom?: string; cne?: string };
}

/** Aperçu fidèle du document ; le PDF signé reste la seule version qui fait foi. */
export function Feuille({ type, annee, semestre, reference, statut, brouillon, poser = false, etudiant }: FeuilleProps) {
  const config = useConfig();
  const releve = type === 'RELEVE_NOTES';
  const cachet: TypeCachet = statut === 'SIGNED' ? 'signe' : statut === 'REVOKED' ? 'annule' : 'attente';
  return (
    <article className={`feuille${statut === 'REVOKED' ? ' feuille-annulee' : ''}`} aria-label="Aperçu du document">
      {brouillon && <div className="feuille-brouillon" aria-hidden="true">Aperçu</div>}
      <div className="feuille-entete">
        {/* Comme sur le PDF : le logo porte les noms de l'université et de la faculté */}
        <img className="feuille-logo" src="/logo.png" alt={`${config.faculty}, ${config.university}`} />
      </div>
      <h3 className="feuille-titre">{TYPES[type].titre}</h3>
      <div className="feuille-sous">Année universitaire {annee}{releve && semestre ? `, semestre ${semestre.slice(1)}` : ''}</div>
      <p>{releve ? 'Relevé des notes obtenues par l\'étudiant(e) :' : `Le Doyen de la ${config.faculty} atteste que l'étudiant(e) :`}</p>
      <dl>
        <dt>Nom et prénom</dt><dd>{etudiant.nom}</dd>
        <dt>CNE</dt><dd>{etudiant.cne}</dd>
      </dl>
      {releve
        ? <div className="feuille-notes">Le détail des modules, des notes et la moyenne du semestre figurent dans le PDF signé.</div>
        : <p>est régulièrement inscrit(e) au titre de l'année universitaire {annee}.</p>}
      <div className="feuille-pied">
        <div className="feuille-ref">{reference ? <>Référence de vérification<strong>{reference}</strong></> : 'La référence de vérification sera attribuée à la signature.'}</div>
        <Cachet type={cachet} poser={poser && cachet === 'signe' && !brouillon} />
      </div>
    </article>
  );
}
