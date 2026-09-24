import { useId, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { PasswordChangeSchema, PASSWORD_MIN_LENGTH, type Me } from '@fsbm/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Alert, Button, describedBy, Field, PageHeader } from '../components/ui';

export function PasswordPage() {
  const { me } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const uid = useId();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const forced = me.mustChangePassword;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (data.newPassword !== data.confirm) return setFields({ confirm: 'Les deux mots de passe ne correspondent pas' });
    const parsed = PasswordChangeSchema.safeParse(data);
    if (!parsed.success) return setFields(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setFields({});
    setError(null);
    setLoading(true);
    try {
      const updated = await api.post<Me>('/auth/password', parsed.data);
      client.setQueryData(['me'], updated);
      form.reset();
      setDone(true);
      if (forced) navigate('/', { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        setFields(e.fields);
        if (!Object.keys(e.fields).length) setError(e.message);
      } else setError('Modification impossible.');
    } finally {
      setLoading(false);
    }
  };

  const input = (name: string, label: string, autoComplete: string, hint?: string) => (
    <Field label={label} htmlFor={`${uid}-${name}`} error={fields[name]} hint={hint}>
      <input id={`${uid}-${name}`} name={name} type="password" autoComplete={autoComplete} className="input" aria-invalid={fields[name] ? true : undefined} aria-describedby={describedBy(`${uid}-${name}`, fields[name], hint)} />
    </Field>
  );

  const content = (
    <form onSubmit={onSubmit} noValidate className="card max-w-lg space-y-5 p-6">
      {forced && <Alert tone="warning" title="Mot de passe provisoire">Pour votre sécurité, choisissez un mot de passe personnel avant d’accéder au back-office.</Alert>}
      {done && <Alert tone="success">Mot de passe modifié. Vos autres sessions ont été fermées.</Alert>}
      {error && <Alert>{error}</Alert>}
      {input('currentPassword', 'Mot de passe actuel', 'current-password')}
      {input('newPassword', 'Nouveau mot de passe', 'new-password', `${PASSWORD_MIN_LENGTH} caractères minimum, avec des lettres et des chiffres.`)}
      {input('confirm', 'Confirmer le nouveau mot de passe', 'new-password')}
      <Button type="submit" variant="primary" loading={loading}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );

  if (forced) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <img src="/images/logo-fsbm.webp" alt="FSBM" className="mb-8 h-14 w-auto" />
          <h1 className="mb-6 font-serif text-[2rem] font-medium">Bienvenue, {me.name}</h1>
          {content}
        </div>
      </div>
    );
  }
  return (
    <>
      <PageHeader title="Mot de passe" description="Modifiez le mot de passe de votre compte." />
      {content}
    </>
  );
}
