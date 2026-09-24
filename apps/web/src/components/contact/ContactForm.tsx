import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ContactMessageSchema, contactSubjectLabels, contactSubjects, type ContactMessage } from '@fsbm/shared';
import { api, ApiError } from '../../lib/api';
import { cn } from '../../lib/format';
import { ArrowRight } from '../ui/Icons';

type Errors = Partial<Record<keyof ContactMessage, string>>;

const fieldClass =
  'mt-2 block w-full border-0 border-b border-midnight/20 bg-transparent px-0 py-3 text-[1rem] text-midnight placeholder:text-muted/60 transition-colors focus:border-gold focus:ring-0 focus:outline-none aria-invalid:border-red-700';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-2 text-[0.75rem] text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-[0.8125rem] text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Formulaire de contact : validé côté client avec le même schéma Zod que l'API,
 * erreurs reliées aux champs (aria-describedby), résumé focalisé en cas d'erreur, piège anti-robots.
 */
export function ContactForm() {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const [errors, setErrors] = useState<Errors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: api.contact,
    onSuccess: () => requestAnimationFrame(() => successRef.current?.focus()),
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fields as Errors);
      requestAnimationFrame(() => summaryRef.current?.focus());
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const parsed = ContactMessageSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) as Errors);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  if (mutation.isSuccess) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="border-t-2 border-gold bg-paper p-10 focus:outline-none">
        <p className="eyebrow text-brand">Message envoyé</p>
        <p className="display mt-5 text-[2.2rem] leading-tight">Merci, votre message a bien été reçu.</p>
        <p className="mt-4 max-w-md text-muted">Le service concerné de la Faculté vous répondra par e-mail dans les meilleurs délais.</p>
        <button type="button" onClick={() => mutation.reset()} className="mt-8 cursor-pointer text-[0.875rem] font-medium underline decoration-gold underline-offset-4">
          Envoyer un autre message
        </button>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const serverError = mutation.isError && !(mutation.error instanceof ApiError && mutation.error.status === 422) ? mutation.error : null;
  const describe = (name: keyof ContactMessage, hint = false) =>
    errors[name] ? `${id(name)}-error` : hint ? `${id(name)}-hint` : undefined;

  return (
    <form noValidate onSubmit={onSubmit} className="relative grid gap-9 bg-paper p-8 shadow-[0_40px_80px_-50px_rgb(10_25_47/0.5)] sm:p-12" aria-labelledby={`${uid}-title`}>
      <div>
        <h2 id={`${uid}-title`} className="display text-[2.3rem] leading-none">Envoyer un message</h2>
        <p className="mt-3 text-[0.875rem] text-muted">Tous les champs sont obligatoires, sauf le téléphone.</p>
      </div>

      <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="focus:outline-none">
        {(errorCount > 0 || serverError) && (
          <div className="border-l-2 border-red-700 bg-red-50 px-5 py-4 text-[0.875rem] text-red-800">
            {serverError
              ? serverError.message
              : `Le formulaire contient ${errorCount} erreur${errorCount > 1 ? 's' : ''}. Corrigez ${errorCount > 1 ? 'les champs indiqués' : 'le champ indiqué'} ci-dessous.`}
          </div>
        )}
      </div>

      <div className="grid gap-9 sm:grid-cols-2">
        <Field id={id('name')} label="Nom complet" error={errors.name}>
          <input id={id('name')} name="name" autoComplete="name" required aria-invalid={Boolean(errors.name)} aria-describedby={describe('name')} className={fieldClass} />
        </Field>
        <Field id={id('email')} label="Adresse e-mail" error={errors.email}>
          <input id={id('email')} name="email" type="email" autoComplete="email" required aria-invalid={Boolean(errors.email)} aria-describedby={describe('email')} className={fieldClass} />
        </Field>
        <Field id={id('phone')} label="Téléphone (facultatif)" error={errors.phone}>
          <input id={id('phone')} name="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={describe('phone')} className={fieldClass} />
        </Field>
        <Field id={id('subject')} label="Objet" error={errors.subject}>
          <select id={id('subject')} name="subject" required defaultValue="" aria-invalid={Boolean(errors.subject)} aria-describedby={describe('subject')} className={cn(fieldClass, 'cursor-pointer')}>
            <option value="" disabled>
              Choisir un objet
            </option>
            {contactSubjects.map((subject) => (
              <option key={subject} value={subject}>
                {contactSubjectLabels[subject]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id={id('message')} label="Votre message" error={errors.message} hint="10 caractères minimum.">
        <textarea
          id={id('message')}
          name="message"
          rows={6}
          required
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describe('message', true)}
          className={cn(fieldClass, 'resize-y')}
        />
      </Field>

      {/* Piège anti-robots : invisible et ignoré par les technologies d'assistance. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-col gap-6 border-t border-midnight/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[0.75rem] leading-relaxed text-muted">
          Vos données sont utilisées uniquement pour répondre à votre demande et ne sont jamais transmises à des tiers.
        </p>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="group relative inline-flex cursor-pointer items-center justify-between gap-5 overflow-hidden bg-midnight py-2 pr-2 pl-6 text-[0.875rem] font-medium tracking-wide text-paper disabled:cursor-wait disabled:opacity-70"
        >
          <span aria-hidden="true" className="absolute inset-0 origin-bottom scale-y-0 bg-midnight-700 transition-transform duration-700 ease-out-expo group-hover:scale-y-100" />
          <span className="relative">{mutation.isPending ? 'Envoi en cours…' : 'Envoyer le message'}</span>
          <span aria-hidden="true" className="relative grid size-10 place-items-center bg-brand text-paper">
            <ArrowRight className="size-3.5 transition-transform duration-500 group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>
    </form>
  );
}
