import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createApi, type Api } from '@esign/api';
import { useAuth } from '@esign/auth';

const ApiContext = createContext<Api | null>(null);

export function ApiProvider({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const { getToken, login } = useAuth();
  const api = useMemo(() => createApi({ baseUrl, getToken, onUnauthorized: () => void login() }), [baseUrl, getToken, login]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi doit être utilisé dans <ApiProvider>');
  return api;
}
