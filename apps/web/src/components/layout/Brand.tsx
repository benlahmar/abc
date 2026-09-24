import { Link } from 'react-router';
import { cn } from '../../lib/format';

/** Logo officiel FSBM : version couleur sur fond clair, version blanche sur fond sombre. */
export function Brand({ tone = 'light', className, size = 'md' }: { tone?: 'light' | 'dark'; className?: string; size?: 'md' | 'lg' }) {
  return (
    <Link to="/" className={cn('group block shrink-0', className)} aria-label="Faculté des Sciences Ben M’Sik, Université Hassan II de Casablanca — accueil">
      <img
        src={tone === 'dark' ? '/images/logo-fsbm-blanc.webp' : '/images/logo-fsbm.webp'}
        alt=""
        width={408}
        height={230}
        decoding="async"
        className={cn(
          'w-auto transition-opacity duration-500 group-hover:opacity-85',
          size === 'lg' ? 'h-20' : 'h-12 sm:h-14',
        )}
      />
    </Link>
  );
}
