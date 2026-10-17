import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@esign/auth';
import { ToastProvider } from '@esign/ui';
import { App } from './App';
import { ApiProvider } from './api';
import './app.css';

/** Configuration propre à chaque environnement (adresse de l'API, Keycloak), lue au démarrage. */
interface AppConfig { apiUrl: string; issuer: string; clientId: string }

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
});

const root = createRoot(document.getElementById('root')!);
fetch('/config.json')
  .then((r) => r.json() as Promise<AppConfig>)
  .then((config) => root.render(
    <StrictMode>
      <AuthProvider config={{ issuer: config.issuer, clientId: config.clientId }}>
        <ApiProvider baseUrl={config.apiUrl}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <App />
            </ToastProvider>
          </QueryClientProvider>
        </ApiProvider>
      </AuthProvider>
    </StrictMode>,
  ))
  .catch(() => root.render(<p className="panne">Configuration introuvable (config.json).</p>));
