import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actionLabels,
  actionsRequiringComment,
  circuitSteps,
  ContentInputSchema,
  statusLabels,
  type AdminCategory,
  type AdminContent,
  type UploadResult,
  type WorkflowAction,
} from '@fsbm/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn, fileSize, formatDateTime, fromCasablancaInput, toCasablancaInput } from '../lib/format';
import { IconArrowLeft, IconCheck, IconClock, IconDoc, IconExternal, IconPlus, IconTrash, IconUpload } from '../components/icons';
import { Alert, Badge, Button, ConfirmAction, describedBy, Field, Spinner, StatusBadge } from '../components/ui';

interface FormState {
  categoryId: string;
  title: string;
  excerpt: string;
  bodyText: string;
  image: string;
  attachments: Array<{ label: string; url: string }>;
  featured: boolean;
  publishAt: string;
  expireAt: string;
}

const nowInput = () => toCasablancaInput(new Date(Date.now() + 5 * 60_000).toISOString());

const emptyForm = (categoryId = ''): FormState => ({
  categoryId,
  title: '',
  excerpt: '',
  bodyText: '',
  image: '',
  attachments: [],
  featured: false,
  publishAt: nowInput(),
  expireAt: '',
});

const fromContent = (c: AdminContent): FormState => ({
  categoryId: c.category.id,
  title: c.title,
  excerpt: c.excerpt,
  bodyText: c.body.join('\n\n'),
  image: c.image,
  attachments: c.attachments.map((a) => ({ ...a })),
  featured: c.featured,
  publishAt: toCasablancaInput(c.publishAt),
  expireAt: toCasablancaInput(c.expireAt),
});

const toPayload = (f: FormState) => ({
  categoryId: f.categoryId,
  title: f.title,
  excerpt: f.excerpt,
  body: f.bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean),
  image: f.image,
  attachments: f.attachments,
  featured: f.featured,
  publishAt: fromCasablancaInput(f.publishAt) ?? '',
  expireAt: fromCasablancaInput(f.expireAt),
});

const actionVariant = (action: WorkflowAction) =>
  action === 'validate' || action === 'publish_urgent' || action === 'restore' ? 'success' : action === 'return' || action === 'withdraw' || action === 'trash' ? 'danger' : 'primary';

const actionHelp: Partial<Record<WorkflowAction, string>> = {
  submit: 'Le contenu part dans le circuit de la catégorie. Vous ne pourrez plus le modifier, sauf s’il vous est renvoyé.',
  approve_review: 'Vous confirmez la relecture (forme, orthographe, pièces jointes). Le contenu passe au validateur.',
  return: 'Le contenu revient à son auteur. Indiquez précisément ce qui doit être corrigé.',
  validate: 'Le contenu sera publié à la date et à l’heure prévues (immédiatement si elles sont passées).',
  publish_urgent: 'Circuit accéléré : la vérification est sautée. La justification est conservée au journal.',
  withdraw: 'Le contenu disparaît immédiatement du site. Indiquez le motif du retrait.',
  archive: 'Le contenu quitte le site mais reste consultable ici.',
  restore: 'Le contenu archivé est remis en ligne.',
  reopen: 'Le contenu repasse en brouillon pour être corrigé puis soumis de nouveau.',
  trash: 'Le contenu est placé dans la corbeille. Seul un administrateur peut l’en sortir.',
};

export function ContentEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const client = useQueryClient();
  const { me } = useAuth();
  const uid = useId();

  const { data: content, isPending, error: loadError } = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.get<AdminContent>(`/contents/${id}`),
    enabled: !isNew,
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<AdminCategory[]>('/categories') });

  const writable = useMemo(
    () => (categories ?? []).filter((c) => c.active && me.memberships.some((m) => m.categoryId === c.id && m.role === 'redacteur')),
    [categories, me],
  );

  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState<FormState | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Initialisation du formulaire (création ou chargement).
  useEffect(() => {
    if (isNew && categories && !form) {
      // Présélection uniquement s'il n'y a qu'une catégorie : sinon, choix explicite (évite les erreurs de circuit).
      const initial = emptyForm(writable.length === 1 ? writable[0]!.id : '');
      setForm(initial);
      setSaved(initial);
    }
    if (content) {
      const next = fromContent(content);
      setForm(next);
      setSaved(next);
    }
    // Réinitialisation volontairement limitée au chargement des données.
  }, [content, categories, isNew]);

  const dirty = form && saved ? JSON.stringify(form) !== JSON.stringify(saved) : false;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const editable = isNew ? writable.length > 0 : Boolean(content?.permissions.edit);
  const category = categories?.find((c) => c.id === form?.categoryId);

  const refresh = (updated: AdminContent) => {
    client.setQueryData(['content', updated.id], updated);
    void client.invalidateQueries({ queryKey: ['dashboard'] });
    void client.invalidateQueries({ queryKey: ['contents'] });
  };

  const save = useMutation({
    mutationFn: (payload: ReturnType<typeof toPayload>) =>
      isNew ? api.post<AdminContent>('/contents', payload) : api.patch<AdminContent>(`/contents/${id}`, { version: content!.version, data: payload }),
    onSuccess: (updated) => {
      refresh(updated);
      setMessage({ tone: 'success', text: isNew ? 'Brouillon créé.' : 'Modifications enregistrées.' });
      if (isNew) navigate(`/actualites/${updated.id}`, { replace: true });
      else {
        const next = fromContent(updated);
        setForm(next);
        setSaved(next);
      }
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setFields(e.fields);
        setMessage({ tone: 'error', text: e.message });
      }
    },
  });

  const transition = useMutation({
    mutationFn: ({ action, comment }: { action: WorkflowAction; comment: string }) =>
      api.post<AdminContent>(`/contents/${id}/transitions`, { action, comment, version: content!.version }),
    onSuccess: (updated, { action }) => {
      setPendingAction(null);
      refresh(updated);
      setMessage({ tone: 'success', text: `${actionLabels[action]} : fait. Statut : ${statusLabels[updated.status]}.` });
      if (updated.id !== id) navigate(`/actualites/${updated.id}`, { replace: true });
    },
  });

  const revision = useMutation({
    mutationFn: () => api.post<AdminContent>(`/contents/${id}/revision`),
    onSuccess: (created) => {
      refresh(created);
      navigate(`/actualites/${created.id}`);
    },
    onError: (e) => setMessage({ tone: 'error', text: e instanceof ApiError ? e.message : 'Révision impossible.' }),
  });

  const adminAction = useMutation({
    mutationFn: async (kind: 'restore' | 'purge'): Promise<AdminContent | null> => {
      if (kind === 'restore') return api.post<AdminContent>(`/contents/${id}/restore`);
      await api.del<void>(`/contents/${id}`);
      return null;
    },
    onSuccess: (result, kind) => {
      void client.invalidateQueries({ queryKey: ['contents'] });
      if (kind === 'purge') navigate('/actualites?statut=trash', { replace: true });
      else if (result) refresh(result);
    },
  });

  if (!isNew && isPending) return <Spinner />;
  if (loadError) return <Alert>{loadError instanceof ApiError ? loadError.message : 'Contenu introuvable.'}</Alert>;
  if (!form || !categories) return <Spinner />;
  if (isNew && writable.length === 0) {
    return <Alert tone="warning" title="Création impossible">Vous n’êtes rédacteur dans aucune catégorie active. Contactez l’administrateur du portail.</Alert>;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const payload = toPayload(form);
    const parsed = ContentInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path.join('.')] ??= issue.message;
      setFields(errs);
      setMessage({ tone: 'error', text: 'Le formulaire contient des erreurs.' });
      return;
    }
    setFields({});
    save.mutate(payload);
  };

  const upload = async (file: File, target: 'image' | 'attachment') => {
    setUploading(target);
    setMessage(null);
    try {
      const result = await api.upload<UploadResult>('/uploads', file);
      if (target === 'image') set('image', result.url);
      else set('attachments', [...form.attachments, { label: result.name.replace(/\.[a-z0-9]+$/i, ''), url: result.url }]);
      setMessage({ tone: 'success', text: `Fichier téléversé (${fileSize(result.size)}).` });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof ApiError ? e.message : 'Téléversement impossible.' });
    } finally {
      setUploading(null);
    }
  };

  const onCategoryChange = (value: string) => {
    const cat = categories.find((c) => c.id === value);
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, categoryId: value };
      // Durée de vie par défaut de la catégorie : date d'expiration proposée.
      if (!f.expireAt && cat?.lifetimeDays && f.publishAt) {
        const start = fromCasablancaInput(f.publishAt);
        if (start) next.expireAt = toCasablancaInput(new Date(new Date(start).getTime() + cat.lifetimeDays * 86_400_000).toISOString());
      }
      return next;
    });
  };

  const f = (name: string) => ({ id: `${uid}-${name}`, 'aria-invalid': fields[name] ? true : undefined, 'aria-describedby': describedBy(`${uid}-${name}`, fields[name]) });
  const steps = circuitSteps(content?.requiresReview ?? category?.requiresReview ?? true);
  const stepState = (stepId: string): 'done' | 'current' | 'todo' => {
    const s = content?.status ?? 'draft';
    const order = ['redaction', 'verification', 'validation', 'publication'];
    const current = { draft: 'redaction', changes_requested: 'redaction', in_review: 'verification', in_validation: 'validation', scheduled: 'publication', published: 'done', archived: 'done', withdrawn: 'done' }[s];
    if (current === 'done') return 'done';
    const i = order.indexOf(stepId);
    const c = order.indexOf(current);
    return i < c ? 'done' : i === c ? 'current' : 'todo';
  };
  const stepWho: Record<string, string | undefined> = {
    redaction: content?.author.name ?? me.name,
    verification: content?.reviewer?.name,
    validation: content?.validator?.name,
    publication: content ? formatDateTime(content.publishAt) : undefined,
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/actualites" className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted hover:text-midnight">
          <IconArrowLeft className="size-4" /> Actualités
        </Link>
        {content && <StatusBadge status={content.status} trashed={content.trashed} />}
        {content?.revisionOf && <Badge tone="warning">Révision</Badge>}
        {dirty && <Badge tone="warning">Modifications non enregistrées</Badge>}
      </div>
      <h1 className="mb-7 font-serif text-[2rem] leading-tight font-medium">{isNew ? 'Nouvelle actualité' : content?.title}</h1>

      {message && <div className="mb-6"><Alert tone={message.tone}>{message.text}</Alert></div>}
      {content?.revisionOf && (
        <div className="mb-6">
          <Alert tone="info" title="Révision d’un contenu publié">
            La version publiée reste en ligne. Cette révision la remplacera une fois validée. <Link to={`/actualites/${content.revisionOf}`} className="font-medium underline">Voir la version publiée</Link>
          </Alert>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={onSubmit} noValidate className="card space-y-6 p-6" aria-label="Contenu de l’actualité">
          <fieldset disabled={!editable || save.isPending} className="space-y-6 disabled:opacity-90">
            {!editable && !isNew && (
              <Alert tone="info">Lecture seule : ce contenu n’est pas modifiable par vous à ce stade du circuit.</Alert>
            )}
            <Field label="Catégorie" htmlFor={`${uid}-categoryId`} error={fields.categoryId} required>
              <select {...f('categoryId')} value={form.categoryId} onChange={(e) => onCategoryChange(e.target.value)} className="input" disabled={!editable || Boolean(content && (content.revisionOf || !['draft', 'changes_requested'].includes(content.status)))}>
                {!form.categoryId && (
                  <option value="" disabled>
                    Choisir la catégorie (elle détermine le circuit de validation)
                  </option>
                )}
                {(isNew || editable ? writable : categories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {!writable.some((c) => c.id === form.categoryId) && category && <option value={category.id}>{category.name}</option>}
              </select>
            </Field>
            {category && (
              <p className="-mt-3 text-[0.75rem] text-muted">
                Circuit : {circuitSteps(category.requiresReview).map((s) => s.label).join(' → ')}
                {category.urgentAllowed && ' · publication en urgence autorisée'}
              </p>
            )}

            <Field label="Titre" htmlFor={`${uid}-title`} error={fields.title} required>
              <input {...f('title')} value={form.title} onChange={(e) => set('title', e.target.value)} className="input text-[1rem]" maxLength={250} />
            </Field>
            <Field label="Chapeau" htmlFor={`${uid}-excerpt`} error={fields.excerpt} hint="Résumé affiché dans les listes (600 caractères maximum).">
              <textarea {...f('excerpt')} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={3} className="input resize-y" maxLength={600} dir="auto" />
            </Field>
            <Field label="Texte" htmlFor={`${uid}-body`} error={fields.body} hint="Séparez les paragraphes par une ligne vide. Le texte est affiché tel quel (pas de HTML).">
              <textarea {...f('body')} value={form.bodyText} onChange={(e) => set('bodyText', e.target.value)} rows={10} className="input resize-y leading-relaxed" dir="auto" />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Publication (heure de Casablanca)" htmlFor={`${uid}-publishAt`} error={fields.publishAt} required hint="Le contenu ne sera visible qu’à partir de cette date, une fois validé.">
                <input {...f('publishAt')} type="datetime-local" value={form.publishAt} onChange={(e) => set('publishAt', e.target.value)} className="input" />
              </Field>
              <Field label="Archivage automatique (facultatif)" htmlFor={`${uid}-expireAt`} error={fields.expireAt} hint={category?.lifetimeDays ? `Durée par défaut de la catégorie : ${category.lifetimeDays} jours.` : 'Laisser vide pour une publication sans limite.'}>
                <input {...f('expireAt')} type="datetime-local" value={form.expireAt} onChange={(e) => set('expireAt', e.target.value)} className="input" />
              </Field>
            </div>

            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="size-4 accent-brand" />
              Mettre à la une sur la page d’accueil
            </label>

            <Field label="Image (facultative)" htmlFor={`${uid}-image`} error={fields.image} hint="JPEG, PNG ou WebP, 15 Mo maximum. Sans image, un visuel FSBM est affiché.">
              <div className="flex gap-2">
                <input {...f('image')} value={form.image} onChange={(e) => set('image', e.target.value)} className="input" placeholder="/uploads/…" />
                <UploadButton label="Téléverser" accept="image/jpeg,image/png,image/webp" loading={uploading === 'image'} onFile={(file) => upload(file, 'image')} />
              </div>
              {form.image && /^\/(uploads|images)\//.test(form.image) && <img src={form.image} alt="" className="mt-3 h-32 rounded-md border border-line object-cover" />}
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Documents joints ({form.attachments.length})</p>
                <div className="flex gap-2">
                  <UploadButton label="Téléverser un PDF" accept="application/pdf,image/jpeg,image/png" loading={uploading === 'attachment'} onFile={(file) => upload(file, 'attachment')} />
                  <Button onClick={() => set('attachments', [...form.attachments, { label: '', url: '' }])}>
                    <IconPlus className="size-4" /> Lien
                  </Button>
                </div>
              </div>
              {form.attachments.length === 0 && <p className="rounded-md border border-dashed border-line px-4 py-5 text-center text-muted">Aucun document.</p>}
              <ul className="space-y-2">
                {form.attachments.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2 rounded-md border border-line p-2.5">
                    <IconDoc className="mt-2.5 size-4 text-muted" />
                    <label className="min-w-40 flex-1">
                      <span className="sr-only">Libellé du document {i + 1}</span>
                      <input
                        value={a.label}
                        placeholder="Libellé (ex. Liste des admis)"
                        onChange={(e) => set('attachments', form.attachments.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                        className="input"
                        aria-invalid={fields[`attachments.${i}.label`] ? true : undefined}
                      />
                    </label>
                    <label className="min-w-52 flex-[2]">
                      <span className="sr-only">Lien du document {i + 1}</span>
                      <input
                        value={a.url}
                        placeholder="/uploads/… ou https://…"
                        onChange={(e) => set('attachments', form.attachments.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                        className="input"
                        aria-invalid={fields[`attachments.${i}.url`] ? true : undefined}
                      />
                    </label>
                    <Button variant="ghost" aria-label={`Retirer le document ${i + 1}`} onClick={() => set('attachments', form.attachments.filter((_, j) => j !== i))}>
                      <IconTrash className="size-4" />
                    </Button>
                    {(fields[`attachments.${i}.label`] || fields[`attachments.${i}.url`]) && (
                      <p className="w-full text-[0.75rem] text-red-700">{fields[`attachments.${i}.label`] ?? fields[`attachments.${i}.url`]}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </fieldset>

          {editable && (
            <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
              {dirty && !isNew && (
                <Button onClick={() => setForm(saved)} disabled={save.isPending}>
                  Annuler les modifications
                </Button>
              )}
              <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty && !isNew}>
                {isNew ? 'Créer le brouillon' : 'Enregistrer'}
              </Button>
            </div>
          )}
        </form>

        <aside className="space-y-6" aria-label="Circuit de publication">
          <section className="card p-5">
            <h2 className="text-[0.9375rem] font-semibold">Circuit de publication</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((step) => {
                const state = stepState(step.id);
                return (
                  <li key={step.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[0.6875rem]',
                        state === 'done' && 'border-emerald-600 bg-emerald-600 text-white',
                        state === 'current' && 'border-brand bg-brand-50 text-brand',
                        state === 'todo' && 'border-line text-muted',
                      )}
                    >
                      {state === 'done' ? <IconCheck className="size-3.5" /> : state === 'current' ? <IconClock className="size-3.5" /> : ''}
                    </span>
                    <div>
                      <p className={cn('font-medium', state === 'todo' && 'text-muted')}>
                        {step.label}
                        <span className="sr-only"> — {state === 'done' ? 'terminé' : state === 'current' ? 'en cours' : 'à venir'}</span>
                      </p>
                      {stepWho[step.id] && state !== 'todo' && <p className="text-[0.75rem] text-muted">{stepWho[step.id]}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {content?.status === 'published' && !content.trashed && (
              <a href={`/actualites/${content.slug}`} target="_blank" rel="noopener" className="mt-5 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand hover:underline">
                Voir sur le site <IconExternal className="size-3.5" />
              </a>
            )}
          </section>

          {content && (
            <section className="card space-y-3 p-5">
              <h2 className="text-[0.9375rem] font-semibold">Actions</h2>
              {dirty && content.permissions.actions.length > 0 && <p className="text-[0.75rem] text-amber-700">Enregistrez vos modifications avant de faire avancer le circuit.</p>}
              {content.permissions.actions.length === 0 && !content.permissions.createRevision && !content.permissions.restoreFromTrash && (
                <p className="text-muted">Aucune action ne vous revient à ce stade.</p>
              )}
              <div className="flex flex-col gap-2">
                {content.permissions.actions.map((action) => (
                  <Button key={action} variant={actionVariant(action)} disabled={dirty} onClick={() => setPendingAction(action)} className="justify-start">
                    {actionLabels[action]}
                  </Button>
                ))}
                {content.permissions.createRevision && (
                  <Button onClick={() => revision.mutate()} loading={revision.isPending} className="justify-start">
                    Modifier (créer une révision)
                  </Button>
                )}
                {content.permissions.restoreFromTrash && (
                  <Button onClick={() => adminAction.mutate('restore')} loading={adminAction.isPending} className="justify-start">
                    Restaurer depuis la corbeille
                  </Button>
                )}
                {content.permissions.purge && (
                  <Button variant="danger" onClick={() => window.confirm('Supprimer définitivement ce contenu ? Cette action est irréversible.') && adminAction.mutate('purge')} className="justify-start">
                    Supprimer définitivement
                  </Button>
                )}
              </div>
            </section>
          )}

          {content && (
            <section className="card p-5">
              <h2 className="text-[0.9375rem] font-semibold">Historique</h2>
              <ol className="mt-4 space-y-4 border-l border-line pl-4">
                <li className="text-[0.8125rem]">
                  <p className="font-medium">Création</p>
                  <p className="text-[0.75rem] text-muted">{content.author.name} · {formatDateTime(content.createdAt)}</p>
                </li>
                {content.comments.map((c) => (
                  <li key={c.id} className="text-[0.8125rem]">
                    <p className="font-medium">{actionLabels[c.action as WorkflowAction] ?? c.action}</p>
                    <p className="text-[0.75rem] text-muted">{c.user?.name ?? 'Système'} · {formatDateTime(c.createdAt)}</p>
                    {c.message && <p className="mt-1.5 rounded-md bg-canvas px-3 py-2 whitespace-pre-line" dir="auto">{c.message}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>

      {pendingAction && content && (
        <ConfirmAction
          open
          onClose={() => {
            setPendingAction(null);
            transition.reset();
          }}
          onConfirm={(comment) => transition.mutate({ action: pendingAction, comment })}
          title={actionLabels[pendingAction]}
          description={
            <>
              <p>{actionHelp[pendingAction]}</p>
              {(pendingAction === 'validate' || pendingAction === 'publish_urgent') && (
                <p className="mt-2 font-medium text-midnight">
                  {new Date(content.publishAt) > new Date() ? `Publication programmée le ${formatDateTime(content.publishAt)}.` : 'Publication immédiate.'}
                </p>
              )}
            </>
          }
          confirmLabel={actionLabels[pendingAction]}
          commentRequired={actionsRequiringComment.includes(pendingAction)}
          commentLabel={pendingAction === 'return' ? 'Corrections demandées' : pendingAction === 'publish_urgent' || pendingAction === 'withdraw' ? 'Justification' : 'Commentaire'}
          variant={actionVariant(pendingAction)}
          loading={transition.isPending}
          error={transition.error instanceof ApiError ? transition.error.message : transition.error ? 'Action impossible.' : undefined}
        />
      )}
    </>
  );
}

function UploadButton({ label, accept, loading, onFile }: { label: string; accept: string; loading: boolean; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <Button onClick={() => ref.current?.click()} loading={loading}>
        <IconUpload className="size-4" /> {label}
      </Button>
    </>
  );
}
