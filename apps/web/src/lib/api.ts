import type { CollectionMap, CollectionName, ContactMessage, NewsDetail, NewsPage } from '@fsbm/shared';

const BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Erreurs par champ renvoyées par l'API (422). */
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!res.ok) throw new ApiError(`Requête ${path} échouée (HTTP ${res.status})`, res.status);
  return (await res.json()) as T;
}

export interface NewsQuery {
  category?: string;
  limit?: number;
  offset?: number;
}

export const api = {
  collection: <N extends CollectionName>(name: N, signal?: AbortSignal) => get<CollectionMap[N]>(`/${name}`, signal),
  news: ({ category, limit = 7, offset = 0 }: NewsQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (category && category !== 'all') params.set('category', category);
    return get<NewsPage>(`/news?${params}`, signal);
  },
  newsItem: (id: string, signal?: AbortSignal) => get<NewsDetail>(`/news/${encodeURIComponent(id)}`, signal),
  contact: async (message: ContactMessage) => {
    const res = await fetch(`${BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(message),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; fields?: Record<string, string> } };
    if (!res.ok) throw new ApiError(body.error?.message ?? 'Envoi impossible', res.status, body.error?.fields);
    return body;
  },
};
