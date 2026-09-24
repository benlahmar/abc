import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router';
import type { CategoryRole, Me } from '@fsbm/shared';
import { api, ApiError, onUnauthorized } from './api';
import { Spinner } from '../components/ui';

interface AuthValue {
  me: Me;
  hasRole: (role: CategoryRole) => boolean;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const useMeQuery = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me'),
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
    staleTime: 60_000,
  });

/** Protège les pages : redirige vers la connexion, ou vers le changement de mot de passe provisoire. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const location = useLocation();
  const { data: me, isPending, error, refetch } = useMeQuery();

  useEffect(() => onUnauthorized(() => client.setQueryData(['me'], null)), [client]);

  if (isPending) return <Spinner />;
  if (!me || (error instanceof ApiError && error.status === 401)) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }
  if (me.mustChangePassword && location.pathname !== '/mot-de-passe') return <Navigate to="/mot-de-passe" replace />;

  const value: AuthValue = { me, hasRole: (role) => me.memberships.some((m) => m.role === role), refresh: refetch };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth hors de RequireAuth');
  return value;
}
