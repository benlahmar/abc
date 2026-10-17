/** Composants partagés par les applications FSBM. */
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import './tokens.css';

// ================================================================== boutons

type Variant = 'default' | 'primary' | 'sign' | 'danger' | 'danger-plein' | 'quiet';

export function Button({ variant = 'default', busy, className = '', children, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  const cls = { default: '', primary: 'btn-primary', sign: 'btn-sign', danger: 'btn-danger', 'danger-plein': 'btn-danger plein', quiet: 'btn-quiet' }[variant];
  return (
    <button type="button" className={`btn ${cls} ${className}`} aria-busy={busy || undefined}
      disabled={busy || props.disabled} {...props}>
      {children}
    </button>
  );
}

// ================================================================== statuts

export type Tone = 'ok' | 'attente' | 'ko';

export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`statut statut-${tone}`}>{children}</span>;
}

// ================================================================== champs

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="champ">
      <span>{label}</span>
      {children}
      {error ? <span className="champ-erreur" role="alert">{error}</span> : hint ? <span className="champ-aide">{hint}</span> : null}
    </label>
  );
}

// ================================================================== notifications

interface Toast { id: number; message: string; error?: boolean; action?: { label: string; run: () => void } }
const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.error ? 9000 : 5000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' toast-erreur' : ''}`} role={t.error ? 'alert' : 'status'}>
            <span>{t.message}</span>
            {t.action && <button type="button" onClick={() => { t.action!.run(); setToasts((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ================================================================== dialogue de confirmation

/** Boîte de dialogue native (focus et Échap gérés par le navigateur). */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialogue" aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      {open && children}
    </dialog>
  );
}

// ================================================================== formats

const RTF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** « il y a 3 heures », « hier »… */
export function relativeTime(iso?: string | null, now = Date.now()): string {
  if (!iso) return '';
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return RTF.format(Math.round(seconds / size), unit);
  }
  return 'à l\'instant';
}

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
