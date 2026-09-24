import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { statusLabels, type ContentStatus } from '@fsbm/shared';
import { cn } from '../lib/format';
import { IconClose } from './icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-700 border-transparent',
  secondary: 'bg-white text-midnight border-line hover:border-midnight/30 hover:bg-canvas',
  ghost: 'bg-transparent text-midnight border-transparent hover:bg-midnight/5',
  danger: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
  success: 'bg-emerald-700 text-white border-transparent hover:bg-emerald-800',
};

export function Button({ variant = 'secondary', className, loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-[0.8125rem] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        className,
      )}
    >
      {loading && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, htmlFor, required }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-red-700" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="mt-1.5 text-[0.75rem] text-muted">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} className="mt-1.5 text-[0.75rem] text-red-700">{error}</p>}
    </div>
  );
}

export const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

const statusStyles: Record<ContentStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  changes_requested: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_review: 'bg-sky-50 text-sky-800 ring-sky-200',
  in_validation: 'bg-violet-50 text-violet-800 ring-violet-200',
  scheduled: 'bg-brand-50 text-brand-700 ring-brand/20',
  published: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  archived: 'bg-stone-100 text-stone-600 ring-stone-200',
  withdrawn: 'bg-red-50 text-red-700 ring-red-200',
};

export function StatusBadge({ status, trashed }: { status: ContentStatus; trashed?: boolean }) {
  if (trashed) return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[0.75rem] font-medium text-red-700 ring-1 ring-red-200 ring-inset">Corbeille</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75rem] font-medium whitespace-nowrap ring-1 ring-inset', statusStyles[status])}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {statusLabels[status]}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warning' | 'success' | 'danger' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-700',
    warning: 'bg-amber-50 text-amber-800',
    success: 'bg-emerald-50 text-emerald-800',
    danger: 'bg-red-50 text-red-700',
  };
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase', tones[tone])}>{children}</span>;
}

export function Alert({ tone = 'error', children, title }: { tone?: 'error' | 'info' | 'success' | 'warning'; children: ReactNode; title?: string }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-brand/20 bg-brand-50 text-brand-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-4 py-3 text-[0.8125rem]', tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-1' : ''}>{children}</div>
    </div>
  );
}

export const Spinner = ({ label = 'Chargement…' }: { label?: string }) => (
  <div role="status" className="flex items-center gap-3 p-8 text-muted">
    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    {label}
  </div>
);

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[2.1rem] leading-none font-medium">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const EmptyState = ({ children }: { children: ReactNode }) => <p className="px-6 py-12 text-center text-muted">{children}</p>;

/** Fenêtre modale sur <dialog> natif (focus piégé, Échap). */
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-0 text-midnight shadow-2xl backdrop:bg-midnight/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-[1rem] font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-canvas" aria-label="Fermer">
          <IconClose className="size-4" />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-canvas/50 px-5 py-3.5">{footer}</div>}
    </dialog>
  );
}

/** Confirmation d'une action, avec commentaire facultatif ou obligatoire. */
export function ConfirmAction({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  commentRequired,
  commentLabel = 'Commentaire',
  variant = 'primary',
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  commentRequired?: boolean;
  commentLabel?: string;
  variant?: Variant;
  loading?: boolean;
  error?: string;
}) {
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const id = useId();
  useEffect(() => {
    if (open) {
      setComment('');
      setTouched(false);
    }
  }, [open]);
  const missing = commentRequired && !comment.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant={variant}
            loading={loading}
            onClick={() => {
              setTouched(true);
              if (!missing) onConfirm(comment.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <div className="mb-4 text-muted">{description}</div>}
      <Field label={commentRequired ? commentLabel : `${commentLabel} (facultatif)`} htmlFor={id} required={commentRequired} error={touched && missing ? 'Ce commentaire est obligatoire.' : undefined}>
        <textarea
          id={id}
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={touched && missing ? true : undefined}
          aria-describedby={describedBy(id, touched && missing ? 'x' : undefined)}
          className="input resize-y"
        />
      </Field>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
    </Modal>
  );
}
