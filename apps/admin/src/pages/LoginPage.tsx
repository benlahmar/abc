import { useId, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { LoginSchema, type Me } from '@fsbm/shared';
import { api, ApiError } from '../lib/api';
import { Alert, Button, describedBy, Field } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const uid = useId();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = LoginSchema.safeParse(data);
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFields({});
    setError(null);
    setLoading(true);
    try {
      const me = await api.post<Me>('/auth/login', parsed.data);
      client.setQueryData(['me'], me);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(me.mustChangePassword ? '/mot-de-passe' : from && from !== '/connexion' ? from : '/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-midnight lg:block">
        <img src="/images/conference-amphi.webp" alt="" className="absolute inset-0 size-full object-cover opacity-35 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/60 to-midnight/30" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <img src="/images/logo-fsbm-blanc.webp" alt="Faculté des Sciences Ben M’Sik" className="h-16 w-auto self-start" />
          <div>
            <p className="font-serif text-[2.8rem] leading-[1.05]">Espace de gestion du portail</p>
            <p className="mt-4 max-w-md text-white/70">Rédaction, vérification et validation des contenus publiés sur le site de la Faculté des Sciences Ben M’Sik.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-5" aria-labelledby={`${uid}-t`}>
          <img src="/images/logo-fsbm.webp" alt="FSBM" className="h-14 w-auto lg:hidden" />
          <div>
            <h1 id={`${uid}-t`} className="font-serif text-[2.2rem] leading-none font-medium">Connexion</h1>
            <p className="mt-2 text-muted">Accès réservé au personnel habilité.</p>
          </div>
          {error && <Alert>{error}</Alert>}
          <Field label="Adresse e-mail" htmlFor={`${uid}-email`} error={fields.email}>
            <input id={`${uid}-email`} name="email" type="email" autoComplete="username" required className="input" aria-invalid={fields.email ? true : undefined} aria-describedby={describedBy(`${uid}-email`, fields.email)} />
          </Field>
          <Field label="Mot de passe" htmlFor={`${uid}-pw`} error={fields.password}>
            <input id={`${uid}-pw`} name="password" type="password" autoComplete="current-password" required className="input" aria-invalid={fields.password ? true : undefined} aria-describedby={describedBy(`${uid}-pw`, fields.password)} />
          </Field>
          <Button type="submit" variant="primary" loading={loading} className="w-full py-2.5">
            Se connecter
          </Button>
          <p className="text-[0.75rem] text-muted">Après 5 tentatives infructueuses, le compte est verrouillé 15 minutes. Mot de passe oublié : contactez l’administrateur du portail.</p>
        </form>
      </div>
    </div>
  );
}
