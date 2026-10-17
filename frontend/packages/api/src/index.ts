/**
 * Client typé de l'API de signature électronique. Les types sont générés depuis le Swagger de l'API
 * (`npm run api:generate`) : toute évolution du contrat backend est visible à la compilation.
 */
import type { components } from './schema';

type Schemas = components['schemas'];
export type DocumentType = NonNullable<Schemas['CreateDocumentRequest']['type']>;
export type DocumentStatus = NonNullable<Schemas['DocumentSummary']['status']>;
export type DocumentSummary = Schemas['DocumentSummary'];
export type DocumentResponse = Schemas['DocumentResponse'];
export type DocumentPage = Schemas['PageResponseDocumentSummary'];
export type CreateDocumentRequest = Schemas['CreateDocumentRequest'];
export type GradeLine = Schemas['GradeLine'];
export type StudentRequest = Schemas['RequestView'];
export type StudentRequestStatus = NonNullable<StudentRequest['status']>;
export type AuditEvent = Schemas['AuditEvent'];

/** Erreur renvoyée par l'API (format RFC 9457), avec le détail par champ quand il existe. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: { field: string; message: string }[];

  constructor(status: number, message: string, fieldErrors: { field: string; message: string }[] = []) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Message pour un champ du formulaire (« student.nom », « grades[0].note »…). */
  forField(field: string): string | undefined {
    return this.fieldErrors.find((e) => e.field === field)?.message;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const problem = await response.json();
    const errors = Array.isArray(problem.errors)
      ? problem.errors.map((e: { field?: string; message?: string }) => ({ field: e.field ?? '', message: e.message ?? '' }))
      : [];
    return new ApiError(response.status, problem.detail ?? `Erreur ${response.status}`, errors);
  } catch {
    return new ApiError(response.status, `Le service a répondu ${response.status}.`);
  }
}

export interface ApiOptions {
  /** Adresse de l'API, ex. http://localhost:8080 */
  baseUrl: string;
  /** Jeton d'accès courant (renouvelé si nécessaire par l'appelant). */
  getToken: () => Promise<string>;
  /** Appelé sur 401 : session expirée. */
  onUnauthorized?: () => void;
}

export interface DocumentQuery {
  q?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  academicYear?: string;
  page?: number;
  size?: number;
}

export function createApi({ baseUrl, getToken, onUnauthorized }: ApiOptions) {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    const response = await fetch(baseUrl + path, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) onUnauthorized?.();
    if (!response.ok) throw await toApiError(response);
    return response;
  }
  const json = async <T>(path: string, init?: RequestInit): Promise<T> => (await request(path, init)).json() as Promise<T>;
  const post = <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    json<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers });

  return {
    // ------------------------------------------------------------ demandes étudiantes
    studentRequests: (status: StudentRequestStatus = 'PENDING') =>
      json<StudentRequest[]>(`/api/v1/student-requests?status=${status}`),
    fulfillFromApogee: (id: string) => post<StudentRequest>(`/api/v1/student-requests/${id}/fulfill-from-apogee`),
    fulfill: (id: string, data: CreateDocumentRequest) => post<StudentRequest>(`/api/v1/student-requests/${id}/fulfill`, data),
    reject: (id: string, reason: string) => post<StudentRequest>(`/api/v1/student-requests/${id}/reject`, { reason }),

    // ------------------------------------------------------------ documents
    searchDocuments: (query: DocumentQuery) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));
      return json<DocumentPage>(`/api/v1/documents?${params}`);
    },
    document: (id: string) => json<DocumentResponse>(`/api/v1/documents/${id}`),
    createDocument: (data: CreateDocumentRequest, idempotencyKey: string) =>
      post<DocumentResponse>('/api/v1/documents', data, { 'Idempotency-Key': idempotencyKey }),
    revoke: (id: string, reason: string) => post<DocumentResponse>(`/api/v1/documents/${id}/revoke`, { reason }),
    downloadDocument: async (id: string) => (await request(`/api/v1/documents/${id}/download`)).blob(),
    documentHistory: (id: string) => json<AuditEvent[]>(`/api/v1/audit/documents/${id}`),

    // ------------------------------------------------------------ Apogée
    apogeeStatus: () => json<{ viewEnabled: boolean }>('/api/v1/apogee/status'),
  };
}

export type Api = ReturnType<typeof createApi>;

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ATTESTATION_SCOLARITE: 'Attestation de scolarité',
  RELEVE_NOTES: 'Relevé de notes',
};
