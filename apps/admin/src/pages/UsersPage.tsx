import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PASSWORD_MIN_LENGTH, UserCreateSchema, type AdminUser } from '@fsbm/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { IconPlus } from '../components/icons';
import { Alert, Badge, Button, describedBy, Field, Modal, PageHeader, Spinner } from '../components/ui';

export function UsersPage() {
  const { me } = useAuth();
  const client = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['users'], queryFn: () => api.get<AdminUser[]>('/users') });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; active?: boolean; isAdmin?: boolean }) => api.patch<AdminUser>(`/users/${id}`, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Modification impossible.'),
  });

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Créez les comptes puis affectez les rôles dans « Catégories et circuits ». Chaque nouveau compte reçoit un mot de passe provisoire à changer à la première connexion."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <IconPlus className="size-4" /> Nouvel utilisateur
          </Button>
        }
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {isPending && <Spinner />}
      {data && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="table-head">
              <tr>
                <th scope="col" className="px-4 py-2.5">Nom</th>
                <th scope="col" className="px-4 py-2.5">E-mail</th>
                <th scope="col" className="px-4 py-2.5">Statut</th>
                <th scope="col" className="px-4 py-2.5">Dernière connexion</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">
                    {u.name} {u.isAdmin && <Badge tone="brand">Admin</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    {!u.active ? <Badge tone="danger">Désactivé</Badge> : u.mustChangePassword ? <Badge tone="warning">Mot de passe provisoire</Badge> : <Badge tone="success">Actif</Badge>}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {u.id !== me.id && (
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => setResetting(u)}>Mot de passe</Button>
                        <Button onClick={() => update.mutate({ id: u.id, isAdmin: !u.isAdmin })}>{u.isAdmin ? 'Retirer admin' : 'Rendre admin'}</Button>
                        <Button variant={u.active ? 'danger' : 'secondary'} onClick={() => update.mutate({ id: u.id, active: !u.active })}>
                          {u.active ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateUserDialog onClose={() => setCreating(false)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const uid = useId();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (payload: object) => api.post<AdminUser>('/users', payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setFields(e.fields);
        setError(e.message);
      }
    },
  });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const parsed = UserCreateSchema.safeParse({ ...data, isAdmin: data.isAdmin === 'on' });
    if (!parsed.success) return setFields(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setFields({});
    create.mutate(parsed.data);
  };
  const input = (name: string, label: string, type = 'text', hint?: string) => (
    <Field label={label} htmlFor={`${uid}-${name}`} error={fields[name]} hint={hint}>
      <input id={`${uid}-${name}`} name={name} type={type} className="input" autoComplete="off" aria-invalid={fields[name] ? true : undefined} aria-describedby={describedBy(`${uid}-${name}`, fields[name], hint)} />
    </Field>
  );
  return (
    <Modal open onClose={onClose} title="Nouvel utilisateur">
      <form id={`${uid}-form`} onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <Alert>{error}</Alert>}
        {input('name', 'Nom complet')}
        {input('email', 'Adresse e-mail', 'email')}
        {input('password', 'Mot de passe provisoire', 'text', `${PASSWORD_MIN_LENGTH} caractères minimum, lettres et chiffres. À transmettre à la personne par un canal sûr.`)}
        <label className="flex items-center gap-2.5">
          <input type="checkbox" name="isAdmin" className="size-4 accent-brand" /> Administrateur du portail
        </label>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Créer le compte
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const client = useQueryClient();
  const uid = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: () => api.post<AdminUser>(`/users/${user.id}/reset-password`, { password }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? (Object.values(e.fields)[0] ?? e.message) : 'Réinitialisation impossible.'),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Mot de passe provisoire — ${user.name}`}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={reset.isPending} onClick={() => reset.mutate()}>
            Définir
          </Button>
        </>
      }
    >
      <p className="mb-4 text-muted">Les sessions de cette personne seront fermées ; elle devra choisir un nouveau mot de passe à sa prochaine connexion.</p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <Field label="Mot de passe provisoire" htmlFor={`${uid}-pw`}>
        <input id={`${uid}-pw`} value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="off" />
      </Field>
    </Modal>
  );
}
