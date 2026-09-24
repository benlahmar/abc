import type { ReactNode } from 'react';
import { cn } from '../../lib/format';
import { Reveal } from './Reveal';

interface SectionHeaderProps {
  index: string;
  eyebrow: string;
  title: ReactNode;
  titleId: string;
  intro?: ReactNode;
  action?: ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
}

/** En-tête éditorial commun : numéro, sur-titre, grand titre serif, chapeau et action. */
export function SectionHeader({ index, eyebrow, title, titleId, intro, action, tone = 'light', className }: SectionHeaderProps) {
  const dark = tone === 'dark';
  return (
    <Reveal as="header" className={cn('grid gap-8 lg:grid-cols-12 lg:items-end', className)}>
      <div className="lg:col-span-7">
        <p className={cn('eyebrow flex items-center gap-4', dark ? 'text-paper/55' : 'text-muted')}>
          <span className={dark ? 'text-gold' : 'text-brand'}>{index}</span>
          <span aria-hidden="true" className={cn('h-px w-10', dark ? 'bg-gold/60' : 'bg-gold')} />
          {eyebrow}
        </p>
        <h2 id={titleId} className="display mt-7 text-[clamp(2.6rem,5.2vw,4.9rem)] leading-[0.98]">
          {title}
        </h2>
      </div>
      {(intro || action) && (
        <div className="lg:col-span-4 lg:col-start-9">
          {intro && <p className={cn('text-[0.975rem] leading-relaxed', dark ? 'text-paper/65' : 'text-muted')}>{intro}</p>}
          {action && <div className="mt-6">{action}</div>}
        </div>
      )}
    </Reveal>
  );
}

/** Mot mis en valeur dans un titre (italique or). */
export const Accent = ({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) => (
  <em className={cn('font-medium italic', tone === 'dark' ? 'text-brand-light' : 'text-brand')}>{children}</em>
);
