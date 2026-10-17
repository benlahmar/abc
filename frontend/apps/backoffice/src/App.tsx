import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@esign/auth';
import { Button } from '@esign/ui';
import { useApi } from './api';
import { useRoute } from './lib/route';
import { roleLabel } from './lib/parametrage';
import { DemandesSection } from './sections/Demandes';
import { DocumentsSection } from './sections/Documents';
import { ImportsSection } from './sections/Imports';
import { RegistreSection } from './sections/Registre';
import { ApprobationsSection } from './sections/Approbations';
import { ParametrageSection } from './sections/Parametrage';
import { AuditSection } from './sections/Audit';

/** Rôles des validateurs du circuit (voir Paramétrage). */
const VALIDATOR_ROLES = ['VICE_DOYEN_PEDAGOGIE', 'DOYEN'];
/** Rôles autorisés à utiliser le back-office. */
const STAFF_ROLES = ['AGENT_SCOLARITE', 'ESIGN_ADMIN', ...VALIDATOR_ROLES];

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
        <p>Votre compte ({auth.user?.username}) n'a aucun rôle du back-office (agent de scolarité, validateur ou administrateur). Contactez l'administrateur
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
  const validateur = hasRole(...VALIDATOR_ROLES);
  const api = useApi();
  const { path, params, navigate } = useRoute();
  const demandee = (['documents', 'imports', 'registre', 'approbations', 'parametrage', 'audit', 'demandes'] as const).find((s) => path.startsWith(`/${s}`));
  const section = demandee ?? (agent ? 'demandes' : validateur ? 'approbations' : 'parametrage');
  const autorisee = section === 'parametrage' || section === 'audit' ? admin : section === 'approbations' ? validateur
    : section === 'registre' ? agent || admin : agent;

  // Compteur affiché dans la navigation, partagé avec la section (même clé de cache)
  const aDecider = useQuery({ queryKey: ['approvals'], queryFn: api.approvals, refetchInterval: 60_000, enabled: validateur });
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
          {(agent || admin) && lien('/registre', 'Registre des inscrits', section === 'registre')}
          {validateur && lien('/approbations', 'Approbations', section === 'approbations', aDecider.data?.length)}
          {admin && lien('/parametrage', 'Paramétrage', section === 'parametrage')}
          {admin && lien('/audit', 'Journal d\'audit', section === 'audit')}
        </div>
        <div className="rail-pied">
          <div className="rail-user">
            <strong>{user?.name}</strong>
            <span>{[agent && 'Agent de scolarité', ...(user?.roles ?? []).filter((r) => VALIDATOR_ROLES.includes(r)).map(roleLabel),
              admin && 'Administrateur'].filter(Boolean).join(', ')}</span>
          </div>
          <button type="button" className="lien" onClick={logout}>Se déconnecter</button>
        </div>
      </nav>
      <main className="plan">
        {!autorisee && (
          <div className="vide"><h2>Section non disponible</h2>
            <p>{section === 'parametrage' || section === 'audit' ? 'Cette section est réservée aux comptes ayant le rôle ESIGN_ADMIN.'
              : section === 'approbations' ? 'Les approbations sont réservées aux validateurs du circuit (vice-doyen, doyen).'
              : 'Cette section est réservée aux agents de scolarité (rôle AGENT_SCOLARITE).'}</p></div>
        )}
        {autorisee && section === 'demandes' && <DemandesSection openDocument={(id) => navigate(`/documents?id=${id}`)} />}
        {autorisee && section === 'documents' && <DocumentsSection selectedId={params.get('id')} onSelect={(id) => navigate(id ? `/documents?id=${id}` : '/documents', true)} />}
        {autorisee && section === 'imports' && <ImportsSection selectedId={params.get('id')} openDocument={(id) => navigate(`/documents?id=${id}`)}
          onSelect={(id) => navigate(id ? `/imports?id=${id}` : '/imports', true)} />}
        {autorisee && section === 'registre' && <RegistreSection />}
        {autorisee && section === 'approbations' && <ApprobationsSection />}
        {autorisee && section === 'parametrage' && <ParametrageSection />}
        {autorisee && section === 'audit' && <AuditSection />}
      </main>
    </div>
  );
}
