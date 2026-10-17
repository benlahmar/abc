import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@esign/auth';
import { Button } from '@esign/ui';
import { useApi } from './api';
import { useRoute } from './lib/route';
import { DemandesSection } from './sections/Demandes';
import { DocumentsSection } from './sections/Documents';
import { ImportsSection } from './sections/Imports';
import { ParametrageSection } from './sections/Parametrage';

/** Rôles autorisés à utiliser le back-office dans cette version. */
const STAFF_ROLES = ['AGENT_SCOLARITE', 'ESIGN_ADMIN'];

export function App() {
  const auth = useAuth();

  if (auth.status === 'loading') return <p className="ecran-centre">Connexion au service d'identité…</p>;
  if (auth.status === 'error') {
    return (
      <div className="ecran-centre">
        <p>{auth.error}</p>
        <Button onClick={() => location.reload()}>Réessayer</Button>
      </div>
    );
  }
  if (auth.status === 'anonymous') {
    return (
      <main className="accueil">
        <img src="/logo.png" alt="Faculté des Sciences Ben M'Sick, Université Hassan II de Casablanca" className="accueil-logo" />
        <h1>Documents officiels, service de scolarité</h1>
        <p>Traitement des demandes étudiantes, recherche et délivrance des attestations et relevés signés.</p>
        <Button variant="primary" onClick={() => void auth.login()}>Se connecter avec mon compte FSBM</Button>
      </main>
    );
  }
  if (!auth.hasRole(...STAFF_ROLES)) {
    return (
      <main className="accueil">
        <img src="/logo.png" alt="" className="accueil-logo" />
        <h1>Accès réservé au personnel</h1>
        <p>Votre compte ({auth.user?.username}) n'a pas de rôle d'agent de scolarité. Contactez l'administrateur
          de la plateforme pour obtenir l'accès.</p>
        <Button onClick={auth.logout}>Se déconnecter</Button>
      </main>
    );
  }
  return <Workspace />;
}

function Workspace() {
  const { user, logout, hasRole } = useAuth();
  // Sections selon les rôles : un compte peut cumuler agent et administrateur
  const agent = hasRole('AGENT_SCOLARITE');
  const admin = hasRole('ESIGN_ADMIN');
  const api = useApi();
  const { path, params, navigate } = useRoute();
  const demandee = (['documents', 'imports', 'parametrage', 'demandes'] as const).find((s) => path.startsWith(`/${s}`));
  const section = demandee ?? (agent ? 'demandes' : 'parametrage');
  const autorisee = section === 'parametrage' ? admin : agent;

  // Compteur affiché dans la navigation, partagé avec la section (même clé de cache)
  const pending = useQuery({ queryKey: ['requests', 'PENDING'], queryFn: () => api.studentRequests('PENDING'), refetchInterval: 60_000, enabled: agent });

  const lien = (to: string, label: string, active: boolean, count?: number) => (
    <a href={to} aria-current={active ? 'page' : undefined}
      onClick={(e) => { e.preventDefault(); navigate(to); }}>
      <span>{label}</span>
      {count !== undefined && count > 0 && <span className="rail-compte num" aria-label={`${count} en attente`}>{count}</span>}
    </a>
  );

  return (
    <div className="atelier">
      <nav className="rail" aria-label="Sections">
        <img src="/logo.png" alt="FSBM" className="rail-logo" />
        <div className="rail-titre">Documents officiels</div>
        <div className="rail-liens">
          {agent && lien('/demandes', 'Demandes étudiantes', section === 'demandes', pending.data?.length)}
          {agent && lien('/documents', 'Documents', section === 'documents')}
          {agent && lien('/imports', 'Imports Apogée', section === 'imports')}
          {admin && lien('/parametrage', 'Paramétrage', section === 'parametrage')}
        </div>
        <div className="rail-pied">
          <div className="rail-user">
            <strong>{user?.name}</strong>
            <span>{[agent && 'Agent de scolarité', admin && 'Administrateur'].filter(Boolean).join(', ')}</span>
          </div>
          <button type="button" className="lien" onClick={logout}>Se déconnecter</button>
        </div>
      </nav>
      <main className="plan">
        {!autorisee && (
          <div className="vide"><h2>Section non disponible</h2>
            <p>{section === 'parametrage' ? 'Le paramétrage est réservé aux comptes ayant le rôle ESIGN_ADMIN.'
              : 'Cette section est réservée aux agents de scolarité (rôle AGENT_SCOLARITE).'}</p></div>
        )}
        {autorisee && section === 'demandes' && <DemandesSection openDocument={(id) => navigate(`/documents?id=${id}`)} />}
        {autorisee && section === 'documents' && <DocumentsSection selectedId={params.get('id')} onSelect={(id) => navigate(id ? `/documents?id=${id}` : '/documents', true)} />}
        {autorisee && section === 'imports' && <ImportsSection selectedId={params.get('id')} openDocument={(id) => navigate(`/documents?id=${id}`)}
          onSelect={(id) => navigate(id ? `/imports?id=${id}` : '/imports', true)} />}
        {autorisee && section === 'parametrage' && <ParametrageSection />}
      </main>
    </div>
  );
}
