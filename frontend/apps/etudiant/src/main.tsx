import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@esign/auth';
import { App, Espace } from './App';
import { ConfigContext, DEMO_CONFIG, type AppConfig } from './config';
import { Toasts } from './components/Toasts';
import { sourceDemo } from './source';
import './app.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
});

const racine = createRoot(document.getElementById('root')!);
const rendre = (config: AppConfig, contenu: ReactNode) => {
  document.title = `Mes documents officiels, ${config.shortName}`;
  racine.render(
    <StrictMode>
      <ConfigContext.Provider value={config}>
        <QueryClientProvider client={queryClient}>
          <Toasts>{contenu}</Toasts>
        </QueryClientProvider>
      </ConfigContext.Provider>
    </StrictMode>,
  );
};

// Démonstration sans serveur ni compte : /?demo
if (new URLSearchParams(location.search).has('demo')) {
  const demo = sourceDemo();
  rendre(DEMO_CONFIG, <Espace source={demo} onDeconnexion={() => location.assign('/')} />);
} else {
  fetch('/config.json')
    .then((r) => r.json() as Promise<AppConfig>)
    .then((config) => rendre(config, (
      <AuthProvider config={{ issuer: config.issuer, clientId: config.clientId }}>
        <App />
      </AuthProvider>
    )))
    .catch(() => racine.render(<p className="chargement">Le service est momentanément injoignable (configuration introuvable).</p>));
}
