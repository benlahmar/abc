import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createApi, type StudentProfile } from '@esign/api';
import { useAuth } from '@esign/auth';
import { AIDE, Atelier } from './Atelier';
import { useConfig } from './config';
import { useToast } from './components/Toasts';
import { sourceApi, type Source } from './source';

/** En-tête : établissement, puis l'étudiant connecté. */
function Entete({ profil, onDeconnexion }: { profil?: StudentProfile; onDeconnexion?: () => void }) {
  const config = useConfig();
  return (
    <header className="entete">
      <div className="etablissement">
        <img className="etablissement-logo" src="/logo.png" alt={config.shortName} />
        <div>
          <span className="etablissement-nom">{config.faculty}</span>
          <span className="etablissement-fac">{config.university}</span>
        </div>
      </div>
      {profil && (
        <div className="identite">
          <span className="identite-nom">{profil.name}</span>
          <span className="identite-cne">CNE {profil.cne}</span>
          <button type="button" className="lien" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(AIDE))}>Raccourcis</button>
          {onDeconnexion && <button type="button" className="lien" onClick={onDeconnexion}>Se déconnecter</button>}
        </div>
      )}
    </header>
  );
}

/** Espace de l'étudiant une fois sa source de données connue (API ou démonstration). */
export function Espace({ source, onDeconnexion }: { source: Source; onDeconnexion?: () => void }) {
  const toast = useToast();
  const profil = useQuery({ queryKey: ['profil'], queryFn: source.profil, retry: false });
  useEffect(() => {
    if (source.demo) toast('Mode démonstration : données d\'exemple, rien n\'est envoyé.', { duree: 6000 });
  }, [source.demo, toast]);
  return (
    <>
      <a className="skip" href="#feuille">Aller au document</a>
      <Entete profil={profil.data} onDeconnexion={onDeconnexion} />
      {profil.isError && (
        <div className="bandeau" role="alert">
          <span>{(profil.error as { status?: number }).status === 403
            ? 'Votre compte n\'est pas associé à un dossier étudiant (CNE). Contactez le service de scolarité.'
            : (profil.error as Error).message}</span>
          <button type="button" className="lien" onClick={() => void profil.refetch()}>Réessayer</button>
        </div>
      )}
      {profil.data && <Atelier source={source} profil={profil.data} />}
    </>
  );
}

/** Application connectée : SSO de l'université, puis l'espace de l'étudiant. */
export function App() {
  const config = useConfig();
  const auth = useAuth();
  const source = useMemo(() => sourceApi(createApi({ baseUrl: config.apiUrl, getToken: auth.getToken, onUnauthorized: () => void auth.login() })),
    [config.apiUrl, auth.getToken, auth.login]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lien depuis l'ENT (?sso=1) : connexion directe, sans page d'accueil
  const sso = new URLSearchParams(location.search).has('sso');
  useEffect(() => { if (auth.status === 'anonymous' && sso) void auth.login(); }, [auth, sso]);

  if (auth.status === 'loading' || (auth.status === 'anonymous' && sso)) return <p className="chargement">Connexion…</p>;
  if (auth.status === 'error') {
    return (<><Entete /><div className="bandeau" role="alert"><span>{auth.error}</span>
      <button type="button" className="lien" onClick={() => location.reload()}>Réessayer</button></div></>);
  }
  if (auth.status === 'anonymous') {
    return (
      <>
        <Entete />
        <main className="accueil">
          <h1>Vos attestations et relevés, signés par la faculté</h1>
          <p>Demandez un document, suivez son traitement et téléchargez la version signée électroniquement,
            que tout organisme peut vérifier en ligne.</p>
          <button type="button" className="bouton bouton-principal" onClick={() => void auth.login()}>Se connecter avec mon compte de l'université</button>
          <p className="accueil-note">Pas encore de compte ? Il vous est remis à l'inscription par le service de scolarité.</p>
        </main>
      </>
    );
  }
  return <Espace source={source} onDeconnexion={auth.logout} />;
}
