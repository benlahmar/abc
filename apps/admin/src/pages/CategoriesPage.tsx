import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CategoryInputSchema, categoryRoles, circuitSteps, roleLabels, type AdminCategory, type AdminUser, type CategoryRole } from '@fsbm/shared';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/format';
import { IconPlus, IconTrash } from '../components/icons';
import { Alert, Badge, Button, describedBy, Field, Modal, PageHeader, Spinner } from '../components/ui';

type CategoryForm = { name: string; slug: string; description: string; requiresReview: boolean; urgentAllowed: boolean; lifetimeDays: string; active: boolean };

const toForm = (c?: AdminCategory): CategoryForm => ({
  name: c?.name ?? '',
  slug: c?.slug ?? '',
  description: c?.description ?? '',
  requiresReview: c?.requiresReview ?? true,
  urgentAllowed: c?.urgentAllowed ?? false,
  lifetimeDays: c?.lifetimeDays ? String(c.lifetimeDays) : '',
  active: c?.active ?? false,
});

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function CategoriesPage() {
  const { data, isPending } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<AdminCategory[]>('/categories') });
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title="Catégories et circuits"
        description="Chaque catégorie définit ses responsables et son circuit de publication. Une catégorie ne peut être activée que si tous ses rôles sont pourvus."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <IconPlus className="size-4" /> Nouvelle catégorie
          </Button>
        }
      />
      {isPending && <Spinner />}
      <div className="grid gap-6 lg:grid-cols-2">
        {data?.map((c) => <CategoryCard key={c.id} category={c} onEdit={() => setEditing(c)} />)}
      </div>
      {editing && <CategoryDialog category={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CategoryCard({ category, onEdit }: { category: AdminCategory; onEdit: () => void }) {
  const client = useQueryClient();
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => api.get<AdminUser[]>('/users') });
  const [adding, setAdding] = useState<{ userId: string; role: CategoryRole }>({ userId: '', role: 'redacteur' });
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  const update = (c: AdminCategory) => client.setQueryData<AdminCategory[]>(['categories'], (list) => list?.map((x) => (x.id === c.id ? c : x)));
  const add = useMutation({
    mutationFn: () => api.post<AdminCategory>(`/categories/${category.id}/members`, adding),
    onSuccess: (c) => {
      update(c);
      setAdding((a) => ({ ...a, userId: '' }));
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Ajout impossible.'),
  });
  const remove = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: CategoryRole }) => api.del<AdminCategory>(`/categories/${category.id}/members/${userId}/${role}`),
    onSuccess: (c) => {
      update(c);
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Retrait impossible.'),
  });

  return (
    <section className="card overflow-hidden" aria-labelledby={`${uid}-name`}>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id={`${uid}-name`} className="flex items-center gap-2 text-[1.05rem] font-semibold">
            {category.name}
            <Badge tone={category.active ? 'success' : 'neutral'}>{category.active ? 'Active' : 'Inactive'}</Badge>
          </h2>
          <p className="mt-1 text-[0.75rem] text-muted">
            {circuitSteps(category.requiresReview).map((s) => s.label).join(' → ')}
            {category.urgentAllowed && ' · urgence autorisée'}
            {category.lifetimeDays && ` · archivage après ${category.lifetimeDays} j`}
          </p>
        </div>
        <Button onClick={onEdit}>Paramètres</Button>
      </div>
      <div className="space-y-4 px-5 py-4">
        {category.issues.length > 0 && (
          <Alert tone="warning" title="Circuit incomplet">
            {category.issues.join(' · ')}
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        {categoryRoles.map((role) => {
          const members = category.members.filter((m) => m.role === role);
          const needed = role !== 'verificateur' || category.requiresReview;
          return (
            <div key={role}>
              <p className={cn('text-[0.75rem] font-semibold tracking-wide uppercase', needed ? 'text-muted' : 'text-muted/50')}>
                {roleLabels[role]}s {!needed && '(étape désactivée)'}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {members.length === 0 && <li className="text-[0.8125rem] text-muted/70">Aucun</li>}
                {members.map((m) => (
                  <li key={m.userId} className="inline-flex items-center gap-1 rounded-full bg-canvas py-0.5 pr-1 pl-2.5 text-[0.8125rem]">
                    {m.name}
                    <button
                      type="button"
                      className="grid size-5 cursor-pointer place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
                      aria-label={`Retirer ${m.name} (${roleLabels[role]})`}
                      onClick={() => remove.mutate({ userId: m.userId, role })}
                    >
                      <IconTrash className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <label className="min-w-44 flex-1">
            <span className="label">Ajouter une personne</span>
            <select className="input" value={adding.userId} onChange={(e) => setAdding((a) => ({ ...a, userId: e.target.value }))}>
              <option value="">Choisir…</option>
              {users?.filter((u) => u.active).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Rôle</span>
            <select className="input" value={adding.role} onChange={(e) => setAdding((a) => ({ ...a, role: e.target.value as CategoryRole }))}>
              {categoryRoles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" disabled={!adding.userId} loading={add.isPending} onClick={() => add.mutate()}>
            Affecter
          </Button>
        </div>
      </div>
    </section>
  );
}

function CategoryDialog({ category, onClose }: { category?: AdminCategory; onClose: () => void }) {
  const client = useQueryClient();
  const uid = useId();
  const [form, setForm] = useState(toForm(category));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (payload: object) => (category ? api.patch<AdminCategory>(`/categories/${category.id}`, payload) : api.post<AdminCategory>('/categories', payload)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setFields(e.fields);
        setError(e.message);
      }
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, lifetimeDays: form.lifetimeDays ? Number(form.lifetimeDays) : null };
    const parsed = CategoryInputSchema.safeParse(payload);
    if (!parsed.success) return setFields(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setFields({});
    save.mutate(parsed.data);
  };
  const input = (key: 'name' | 'slug' | 'lifetimeDays', label: string, hint?: string, extra: object = {}) => (
    <Field label={label} htmlFor={`${uid}-${key}`} error={fields[key]} hint={hint}>
      <input
        id={`${uid}-${key}`}
        value={form[key]}
        onChange={(e) =>
          setForm((f) => ({ ...f, [key]: e.target.value, ...(key === 'name' && !category && (!f.slug || f.slug === slugify(f.name)) ? { slug: slugify(e.target.value) } : {}) }))
        }
        aria-invalid={fields[key] ? true : undefined}
        aria-describedby={describedBy(`${uid}-${key}`, fields[key], hint)}
        className="input"
        {...extra}
      />
    </Field>
  );
  const toggle = (key: 'requiresReview' | 'urgentAllowed' | 'active', label: string, hint: string) => (
    <label className="flex gap-3">
      <input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} className="mt-0.5 size-4 accent-brand" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-[0.75rem] text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? `Paramètres — ${category.name}` : 'Nouvelle catégorie'}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={save.isPending} onClick={onSubmit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <Alert>{error}</Alert>}
        {input('name', 'Nom')}
        {input('slug', 'Identifiant', 'Utilisé dans les adresses du site (ex. vie-etudiante).', category ? { readOnly: true } : {})}
        <Field label="Description" htmlFor={`${uid}-description`}>
          <textarea id={`${uid}-description`} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input" />
        </Field>
        {toggle('requiresReview', 'Étape de vérification', 'Relecture par un vérificateur avant la validation. Les contenus déjà soumis gardent leur circuit.')}
        {toggle('urgentAllowed', 'Publication en urgence', 'Le validateur peut publier directement un contenu en relecture, avec justification.')}
        {input('lifetimeDays', 'Durée de vie par défaut (jours)', 'Propose une date d’archivage automatique. Laisser vide : aucune.', { type: 'number', min: 1 })}
        {toggle('active', 'Catégorie active', 'Nécessite au moins un rédacteur et un validateur (et un vérificateur si l’étape est requise).')}
      </form>
    </Modal>
  );
}
