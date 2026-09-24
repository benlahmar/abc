/** Client de l'API d'administration : cookie de session + en-tête anti-CSRF sur chaque requête. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Appelé quand la session expire (401), pour renvoyer vers la connexion. */
export const onUnauthorized = (listener: Listener): (() => void) => {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'x-fsbm-csrf': '1',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string; fields?: Record<string, string> } };
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) unauthorizedListeners.forEach((l) => l());
    throw new ApiError(data.error?.message ?? `Erreur ${res.status}`, res.status, data.error?.code ?? 'error', data.error?.fields);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>('POST', path, form);
  },
};
