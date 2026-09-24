import { NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminDashboard } from '@fsbm/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/format';
import { IconDashboard, IconExternal, IconFolder, IconKey, IconLog, IconLogout, IconNews, IconUsers } from './icons';

export function Layout() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<AdminDashboard>('/dashboard'), refetchInterval: 60_000 });
  const pending = dashboard?.pending.length ?? 0;

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    client.clear();
    navigate('/connexion', { replace: true });
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    cn('flex items-center gap-3 rounded-md px-3 py-2 text-[0.8125rem] font-medium transition-colors', isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white');

  return (
    <div className="flex min-h-dvh">
      <a href="#contenu" className="sr-only z-50 bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Aller au contenu
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-midnight px-4 py-6 text-white md:flex" aria-label="Navigation du back-office">
        <div className="px-2">
          <img src="/images/logo-fsbm-blanc.webp" alt="FSBM" className="h-12 w-auto" />
          <p className="mt-3 text-[0.6875rem] font-semibold tracking-[0.18em] text-white/45 uppercase">Back-office</p>
        </div>
        <nav className="mt-8 flex-1 space-y-1">
          <NavLink to="/" end className={link}>
            <IconDashboard className="size-4" /> Tableau de bord
            {pending > 0 && <span className="ml-auto rounded-full bg-gold px-1.5 text-[0.6875rem] font-semibold text-midnight" aria-label={`${pending} en attente`}>{pending}</span>}
          </NavLink>
          <NavLink to="/actualites" className={link}>
            <IconNews className="size-4" /> Actualités
          </NavLink>
          {me.isAdmin && (
            <>
              <p className="px-3 pt-6 pb-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-white/40 uppercase">Administration</p>
              <NavLink to="/categories" className={link}>
                <IconFolder className="size-4" /> Catégories et circuits
              </NavLink>
              <NavLink to="/utilisateurs" className={link}>
                <IconUsers className="size-4" /> Utilisateurs
              </NavLink>
              <NavLink to="/journal" className={link}>
                <IconLog className="size-4" /> Journal d’audit
              </NavLink>
            </>
          )}
        </nav>
        <div className="space-y-1 border-t border-white/10 pt-4">
          <a href="/" target="_blank" rel="noopener" className={link({ isActive: false })}>
            <IconExternal className="size-4" /> Voir le site
          </a>
          <NavLink to="/mot-de-passe" className={link}>
            <IconKey className="size-4" /> Mot de passe
          </NavLink>
          <button type="button" onClick={logout} className={cn(link({ isActive: false }), 'w-full cursor-pointer')}>
            <IconLogout className="size-4" /> Déconnexion
          </button>
          <div className="mt-3 rounded-md bg-white/5 px-3 py-2.5">
            <p className="truncate text-[0.8125rem] font-medium">{me.name}</p>
            <p className="truncate text-[0.75rem] text-white/50">{me.isAdmin ? 'Administrateur' : me.email}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barre compacte pour petits écrans */}
        <header className="flex items-center justify-between bg-midnight px-4 py-3 text-white md:hidden">
          <img src="/images/logo-fsbm-blanc.webp" alt="FSBM" className="h-9 w-auto" />
          <nav aria-label="Navigation" className="flex gap-1 text-[0.75rem]">
            <NavLink to="/" end className={link}>Tableau</NavLink>
            <NavLink to="/actualites" className={link}>Actualités</NavLink>
            <button type="button" onClick={logout} className={cn(link({ isActive: false }), 'cursor-pointer')}>Sortir</button>
          </nav>
        </header>
        <main id="contenu" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8 focus:outline-none sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
