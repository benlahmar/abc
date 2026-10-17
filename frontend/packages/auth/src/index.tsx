/**
 * Connexion OIDC (code d'autorisation + PKCE) auprès du SSO de l'université (Keycloak), sans bibliothèque
 * externe. Le jeton est gardé en mémoire de session et renouvelé automatiquement avant son expiration.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface AuthConfig {
  /** Émetteur OIDC, ex. http://localhost:8180/realms/universite */
  issuer: string;
  clientId: string;
}

export interface User {
  username: string;
  name: string;
  /** Rôles du realm (AGENT_SCOLARITE, ESIGN_ADMIN…). */
  roles: string[];
}

interface Tokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_at: number; // ms
}

interface Endpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

const STORAGE_KEY = 'esign.tokens';
const PKCE_KEY = 'esign.pkce';

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

/** Contenu (non vérifié) du jeton : la vérification est faite par l'API, ceci ne sert qu'à l'affichage. */
export function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split('.')[1] ?? '';
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function userFromToken(token: string): User {
  const claims = decodeJwt(token);
  const realm = claims.realm_access as { roles?: string[] } | undefined;
  const username = String(claims.preferred_username ?? claims.sub ?? '');
  return { username, name: String(claims.name ?? username), roles: realm?.roles ?? [] };
}

interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated' | 'error';
  user?: User;
  error?: string;
  login: () => Promise<void>;
  logout: () => void;
  /** Jeton d'accès valide (renouvelé si besoin). */
  getToken: () => Promise<string>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ config, children }: { config: AuthConfig; children: ReactNode }) {
  const [state, setState] = useState<Pick<AuthState, 'status' | 'user' | 'error'>>({ status: 'loading' });
  const endpoints = useRef<Endpoints | null>(null);
  const tokens = useRef<Tokens | null>(null);
  const redirectUri = window.location.origin + '/';

  const store = useCallback((t: Tokens | null) => {
    tokens.current = t;
    if (t) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(STORAGE_KEY);
    setState(t ? { status: 'authenticated', user: userFromToken(t.access_token) } : { status: 'anonymous' });
  }, []);

  const tokenRequest = useCallback(async (body: Record<string, string>) => {
    const response = await fetch(endpoints.current!.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, ...body }),
    });
    if (!response.ok) throw new Error('Connexion refusée par le service d\'identité.');
    const t = await response.json();
    return { ...t, expires_at: Date.now() + t.expires_in * 1000 } as Tokens;
  }, [config.clientId]);

  const login = useCallback(async () => {
    const verifier = random();
    const stateParam = random();
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state: stateParam, back: location.pathname + location.search }));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const params = new URLSearchParams({
      response_type: 'code', client_id: config.clientId, redirect_uri: redirectUri, scope: 'openid profile',
      state: stateParam, code_challenge: challenge, code_challenge_method: 'S256',
    });
    window.location.assign(`${endpoints.current!.authorization_endpoint}?${params}`);
  }, [config.clientId, redirectUri]);

  const logout = useCallback(() => {
    const idToken = tokens.current?.id_token;
    store(null);
    const end = endpoints.current?.end_session_endpoint;
    if (!end) { window.location.assign(redirectUri); return; }
    const params = new URLSearchParams({ client_id: config.clientId, post_logout_redirect_uri: redirectUri });
    if (idToken) params.set('id_token_hint', idToken);
    window.location.assign(`${end}?${params}`);
  }, [config.clientId, redirectUri, store]);

  const getToken = useCallback(async () => {
    const t = tokens.current;
    if (!t) throw new Error('Non connecté');
    if (t.expires_at - Date.now() > 30_000) return t.access_token;
    if (!t.refresh_token) { await login(); throw new Error('Session expirée'); }
    try {
      const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
      store(fresh);
      return fresh.access_token;
    } catch {
      store(null);
      throw new Error('Session expirée : reconnectez-vous.');
    }
  }, [login, store, tokenRequest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        endpoints.current = await (await fetch(`${config.issuer}/.well-known/openid-configuration`)).json();
        const query = new URLSearchParams(location.search);
        if (query.has('code')) {
          const pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? '{}');
          sessionStorage.removeItem(PKCE_KEY);
          if (!pkce.state || pkce.state !== query.get('state')) throw new Error('Réponse de connexion invalide : reconnectez-vous.');
          const t = await tokenRequest({ grant_type: 'authorization_code', code: query.get('code')!, redirect_uri: redirectUri, code_verifier: pkce.verifier });
          history.replaceState(null, '', pkce.back || '/');
          if (!cancelled) store(t);
          return;
        }
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (!cancelled) store(saved ? JSON.parse(saved) : null);
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, [config.issuer, redirectUri, store, tokenRequest]);

  const value = useMemo<AuthState>(() => ({
    ...state, login, logout, getToken,
    hasRole: (...roles) => roles.some((r) => state.user?.roles.includes(r)),
  }), [state, login, logout, getToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
