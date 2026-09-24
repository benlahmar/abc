import { Link } from 'react-router';
import { cn } from '../../lib/format';

/** Identité FSBM : monogramme + nom. `tone="dark"` pour un fond sombre. */
export function Brand({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const dark = tone === 'dark';
  return (
    <Link to="/" className={cn('group flex shrink-0 items-center gap-3.5', className)} aria-label="Faculté des Sciences Ben M’Sik — accueil">
      <span
        aria-hidden="true"
        className={cn(
          'relative grid h-11 place-items-center px-2.5 text-[0.8125rem] font-semibold tracking-[0.12em] transition-colors duration-500',
          dark ? 'bg-paper text-midnight-950' : 'bg-midnight text-paper',
        )}
      >
        FSBM
        <span className="absolute top-0 left-0 size-2.5 origin-top-left bg-gold transition-transform duration-700 ease-out-expo [clip-path:polygon(0_0,100%_0,0_100%)] group-hover:scale-[1.8]" />
      </span>
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span className="font-serif text-[1.35rem] font-medium tracking-tight">Faculté des Sciences</span>
        <span className={cn('mt-1.5 text-[0.5625rem] font-semibold tracking-[0.16em] uppercase', dark ? 'text-paper/55' : 'text-muted')}>
          Ben M’Sik <span className="text-gold">·</span> <span className="sm:hidden">UH2C</span>
          <span className="hidden sm:inline">Université Hassan II</span>
        </span>
      </span>
    </Link>
  );
}
