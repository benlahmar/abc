import { cn } from '../../lib/format';

/**
 * Visuel « officiel » des annonces sans photo : aplat bleu FSBM, logo blanc et étiquette.
 * Plus juste qu'un motif abstrait pour des listes, résultats et avis administratifs.
 */
export function OfficialVisual({ label, className, compact = false }: { label?: string; className?: string; compact?: boolean }) {
  return (
    <div aria-hidden="true" className={cn('absolute inset-0 overflow-hidden bg-brand', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgb(157_184_230/0.35),transparent_60%),linear-gradient(160deg,transparent_40%,rgb(6_17_42/0.55))]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_22px,rgb(255_255_255/0.035)_22px_23px)]" />
      <img
        src="/images/logo-fsbm-blanc.webp"
        alt=""
        className={cn('absolute top-1/2 left-1/2 w-auto -translate-x-1/2 -translate-y-1/2 opacity-90', compact ? 'h-12' : 'h-16 sm:h-20')}
      />
      {label && <span className="eyebrow absolute bottom-4 left-5 text-paper/75">{label}</span>}
    </div>
  );
}
