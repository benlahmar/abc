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
export type Batch = Schemas['BatchResponse'];
export type BatchStatus = NonNullable<Batch['status']>;
export type BatchPage = Schemas['PageResponseBatchResponse'];
export type BatchItem = Schemas['BatchItemView'];
export type BatchItemStatus = NonNullable<BatchItem['status']>;
export type DryRunReport = Schemas['DryRunReport'];
export type ApogeeExtraction = Schemas['ApogeeExtraction'];
export type Workflow = Schemas['WorkflowDefinition'];
export type WorkflowStep = Schemas['WorkflowStepDto'];
export type WorkflowCondition = WorkflowStep['condition'];
export type StudentAccessSetting = Schemas['Setting'];
export type StudentAccessMode = Schemas['Update']['mode'];
export type AuditPage = Schemas['PageResponseAuditEvent'];
export type AuditTypeCount = Schemas['TypeCount'];
export type AuditVerification = Schemas['ChainVerification'];

/** Critères du journal d'audit ; dates au format AAAA-MM-JJ, « to » incluse. */
export interface AuditQuery {
  types?: string[];
  actor?: string;
  q?: string;
  documentId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

function auditParams({ types = [], ...rest }: AuditQuery) {
  const params = new URLSearchParams();
  types.forEach((t) => params.append('type', t));
  Object.entries(rest).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));
  return params;
}
export type ApprovalTask = Schemas['Task'];
export type StudentProfile = Schemas['Profile'];
export type StudentOffer = Schemas['Offer'];
export type MyDocument = Schemas['MyDocument'];
export type MyRequest = Schemas['MyRequest'];
export type NewStudentRequest = Schemas['NewRequest'];
export type RegistryOverview = Schemas['RegistryOverview'];
export type RegistryFiliere = Schemas['RegistryFiliere'];
export type RegistryReport = Schemas['RegistryReport'];
export type RegistryFiliereDiff = Schemas['RegistryFiliereDiff'];
export type RegistryPerson = Schemas['RegistryPerson'];
export type RegistryStudent = Schemas['RegistryStudentView'];
export type RegistryStudentPage = Schemas['PageResponseRegistryStudentView'];
export type ApprovalDecision = Schemas['Decision'];
export type ApprovalStep = Schemas['Approval'];
export type ApprovalStatus = NonNullable<ApprovalStep['status']>;

export interface ImportOptions {
  type: DocumentType;
  purpose?: string;
}

const formWith = (file: File) => { const f = new FormData(); f.append('file', file); return f; };
const importPath = ({ type, purpose }: ImportOptions, dryRun: boolean) =>
  `/api/v1/batches/import?${new URLSearchParams({ type, dryRun: String(dryRun), ...(purpose ? { purpose } : {}) })}`;

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
      // Corps JSON sous forme de texte ; un FormData garde le Content-Type multipart choisi par le navigateur
      headers: { ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) onUnauthorized?.();
    if (!response.ok) throw await toApiError(response);
    return response;
  }
  const json = async <T>(path: string, init?: RequestInit): Promise<T> => (await request(path, init)).json() as Promise<T>;
  const post = <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    json<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers });

  return {
    // ------------------------------------------------------------ espace étudiant (/api/v1/me)
    me: () => json<StudentProfile>('/api/v1/me'),
    myDocuments: () => json<MyDocument[]>('/api/v1/me/documents'),
    myRequests: () => json<MyRequest[]>('/api/v1/me/requests'),
    createMyRequest: (data: NewStudentRequest) => post<MyRequest>('/api/v1/me/requests', data),
    downloadMyDocument: async (id: string) => (await request(`/api/v1/me/documents/${id}/download`)).blob(),

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

    // ------------------------------------------------------------ traitements en masse
    batches: (page = 0, size = 20) => json<BatchPage>(`/api/v1/batches?page=${page}&size=${size}`),
    batch: (id: string) => json<Batch>(`/api/v1/batches/${id}`),
    batchItems: (id: string, status?: BatchItemStatus) =>
      json<BatchItem[]>(`/api/v1/batches/${id}/items${status ? `?status=${status}` : ''}`),
    /** Vérifie un export Apogée (CSV ou Excel) sans rien signer. */
    checkFile: (file: File, options: ImportOptions) => json<DryRunReport>(importPath(options, true), { method: 'POST', body: formWith(file) }),
    /** Lance la production des documents d'un export Apogée (traitement en arrière-plan). */
    importFile: (file: File, options: ImportOptions) => json<Batch>(importPath(options, false), { method: 'POST', body: formWith(file) }),
    checkApogee: (extraction: Omit<ApogeeExtraction, 'dryRun'>) =>
      post<DryRunReport>('/api/v1/batches/apogee', { ...extraction, dryRun: true }),
    extractApogee: (extraction: Omit<ApogeeExtraction, 'dryRun'>) =>
      post<Batch>('/api/v1/batches/apogee', { ...extraction, dryRun: false }),
    // ------------------------------------------------------------ registre des inscrits
    registry: (academicYear?: string) =>
      json<RegistryOverview>(`/api/v1/registry${academicYear ? `?academicYear=${academicYear}` : ''}`),
    checkRegistry: (file: File, academicYear: string) =>
      json<RegistryReport>(`/api/v1/registry/import?${new URLSearchParams({ academicYear, dryRun: 'true' })}`, { method: 'POST', body: formWith(file) }),
    importRegistry: (file: File, academicYear: string) =>
      json<RegistryReport>(`/api/v1/registry/import?${new URLSearchParams({ academicYear, dryRun: 'false' })}`, { method: 'POST', body: formWith(file) }),
    registryStudents: (query: { academicYear: string; filiere?: string; q?: string; blocked?: boolean; page?: number; size?: number }) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => v !== undefined && v !== '' && v !== false && params.set(k, String(v)));
      return json<RegistryStudentPage>(`/api/v1/registry/students?${params}`);
    },
    blockStudent: (id: number, reason: string) => post<RegistryStudent>(`/api/v1/registry/students/${id}/block`, { reason }),
    unblockStudent: (id: number) => post<RegistryStudent>(`/api/v1/registry/students/${id}/unblock`),
    purgeRegistry: (academicYear: string) => json<{ removed: number }>(`/api/v1/registry/${academicYear}`, { method: 'DELETE' }),

    // ------------------------------------------------------------ approbations (validateurs)
    approvals: () => json<ApprovalTask[]>('/api/v1/approvals'),
    approvalDecisions: () => json<ApprovalDecision[]>('/api/v1/approvals/decided'),
    approvalDocument: (id: string) => json<DocumentResponse>(`/api/v1/approvals/${id}`),
    approvalPreview: async (id: string) => (await request(`/api/v1/approvals/${id}/preview`)).blob(),
    approve: (id: string, decision: { comment?: string; escalate?: boolean } = {}) =>
      post<DocumentResponse>(`/api/v1/approvals/${id}/approve`, decision),
    rejectApproval: (id: string, reason: string) => post<DocumentResponse>(`/api/v1/approvals/${id}/reject`, { reason }),

    // ------------------------------------------------------------ paramétrage (administrateur)
    workflows: () => json<Workflow[]>('/api/v1/admin/workflows'),
    saveWorkflow: (type: DocumentType, steps: WorkflowStep[]) =>
      json<Workflow>(`/api/v1/admin/workflows/${type}`, { method: 'PUT', body: JSON.stringify({ steps }) }),
    studentAccess: () => json<StudentAccessSetting[]>('/api/v1/admin/student-access'),
    saveStudentAccess: (type: DocumentType, mode: StudentAccessMode, dailyLimit: number) =>
      json<StudentAccessSetting>(`/api/v1/admin/student-access/${type}`, { method: 'PUT', body: JSON.stringify({ mode, dailyLimit }) }),
    auditEvents: (types: string[] = [], page = 0, size = 50) => json<AuditPage>(`/api/v1/audit/events?${auditParams({ types, page, size })}`),
    auditSearch: (query: AuditQuery) => json<AuditPage>(`/api/v1/audit/events?${auditParams(query)}`),
    auditExport: async (query: AuditQuery) => (await request(`/api/v1/audit/events.csv?${auditParams({ ...query, page: undefined, size: undefined })}`)).blob(),
    auditTypes: () => json<AuditTypeCount[]>('/api/v1/audit/types'),
    verifyAudit: () => json<AuditVerification>('/api/v1/audit/verify'),

    downloadBatchFile: async (id: string, file: 'report.csv' | 'archive.zip') =>
      (await request(`/api/v1/batches/${id}/${file}`)).blob(),
  };
}

export type Api = ReturnType<typeof createApi>;

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  ATTESTATION_SCOLARITE: 'Attestation de scolarité',
  RELEVE_NOTES: 'Relevé de notes',
};

export const DOCUMENT_PLURALS: Record<DocumentType, string> = {
  ATTESTATION_SCOLARITE: 'Attestations de scolarité',
  RELEVE_NOTES: 'Relevés de notes',
};
