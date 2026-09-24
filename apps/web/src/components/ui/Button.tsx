import type { ReactNode } from 'react';
import { cn } from '../../lib/format';
import { ArrowRight } from './Icons';
import { SmartLink } from './SmartLink';

type Variant = 'light' | 'brand' | 'dark' | 'outline-light' | 'outline-dark';

const variants: Record<Variant, { root: string; fill: string; arrow: string }> = {
  light: { root: 'bg-paper text-midnight-950', fill: 'bg-white', arrow: 'bg-brand text-paper' },
  brand: { root: 'bg-brand text-paper', fill: 'bg-brand-700', arrow: 'bg-paper text-brand' },
  dark: { root: 'bg-midnight text-paper', fill: 'bg-midnight-700', arrow: 'bg-brand text-paper' },
  'outline-light': { root: 'border border-paper/30 text-paper hover:border-paper/60', fill: 'bg-paper/[0.07]', arrow: 'border border-paper/30 text-paper' },
  'outline-dark': { root: 'border border-midnight/25 text-midnight hover:border-midnight', fill: 'bg-midnight/[0.04]', arrow: 'border border-midnight/20 text-midnight' },
};

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

/** Bouton-lien : remplissage qui monte au survol et pastille fléchée qui glisse. */
export function ButtonLink({ href, children, variant = 'dark', className }: ButtonLinkProps) {
  const v = variants[variant];
  return (
    <SmartLink
      href={href}
      className={cn(
        'group relative inline-flex items-center justify-between gap-5 overflow-hidden py-2 pr-2 pl-6 text-[0.875rem] font-medium tracking-wide transition-colors duration-500',
        v.root,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-0 origin-bottom scale-y-0 transition-transform duration-700 ease-out-expo group-hover:scale-y-100', v.fill)} />
      <span className="relative">{children}</span>
      <span aria-hidden="true" className={cn('relative grid size-10 place-items-center overflow-hidden', v.arrow)}>
        <ArrowRight className="size-3.5 transition-transform duration-500 ease-out-expo group-hover:translate-x-[180%]" />
        <ArrowRight className="absolute size-3.5 -translate-x-[180%] transition-transform duration-500 ease-out-expo group-hover:translate-x-0" />
      </span>
    </SmartLink>
  );
}

/** Lien texte avec soulignement dessiné et flèche. */
export function ArrowLink({ href, children, tone = 'light', className }: { href: string; children: ReactNode; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <SmartLink href={href} className={cn('group inline-flex items-center gap-2.5 text-[0.875rem] font-medium', tone === 'dark' ? 'text-paper' : 'text-midnight', className)}>
      <span className="link-draw pb-0.5">{children}</span>
      <ArrowRight className={cn('size-3.5 transition-transform duration-500 ease-out-expo group-hover:translate-x-1', tone === 'dark' ? 'text-brand-light' : 'text-brand')} />
    </SmartLink>
  );
}
