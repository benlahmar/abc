import { cn } from '../../lib/format';

/**
 * Visuels génératifs aux couleurs FSBM, utilisés tant qu'une photo n'est pas fournie
 * par le back-office. Chaque variante évoque une discipline (ondes, réseau, strates, hélice…).
 */
export type VisualVariant = 'rings' | 'grid' | 'helix' | 'strata' | 'dots' | 'orbit';

const patterns: Record<VisualVariant, string> = {
  rings:
    'bg-[repeating-radial-gradient(circle_at_70%_40%,transparent_0_15px,rgb(197_160_89/0.45)_15px_16px),radial-gradient(circle_at_70%_40%,rgb(197_160_89/0.28),transparent_60%)]',
  grid:
    'bg-[linear-gradient(rgb(248_250_252/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(248_250_252/0.07)_1px,transparent_1px),radial-gradient(ellipse_at_25%_75%,rgb(197_160_89/0.35),transparent_55%)] bg-[length:28px_28px,28px_28px,100%_100%]',
  helix:
    'bg-[repeating-linear-gradient(115deg,transparent_0_20px,rgb(248_250_252/0.08)_20px_21px),repeating-linear-gradient(65deg,transparent_0_20px,rgb(197_160_89/0.32)_20px_21px)]',
  strata:
    'bg-[repeating-linear-gradient(172deg,#0a192f_0_12px,#112240_12px_26px,rgb(197_160_89/0.3)_26px_27px)]',
  dots: 'bg-[radial-gradient(rgb(248_250_252/0.3)_1px,transparent_1.5px),radial-gradient(ellipse_at_80%_20%,rgb(197_160_89/0.3),transparent_55%)] bg-[length:16px_16px,100%_100%]',
  orbit:
    'bg-[radial-gradient(circle_at_50%_120%,transparent_38%,rgb(197_160_89/0.5)_38.3%,transparent_38.8%,transparent_52%,rgb(248_250_252/0.18)_52.3%,transparent_52.8%,transparent_66%,rgb(248_250_252/0.1)_66.3%,transparent_66.8%),radial-gradient(ellipse_at_50%_110%,rgb(197_160_89/0.3),transparent_60%)]',
};

const byCategory: Record<string, VisualVariant> = {
  recherche: 'rings',
  campus: 'grid',
  partenariat: 'helix',
  evenements: 'orbit',
  services: 'strata',
  reussite: 'dots',
};

export const variantFor = (key: string, index = 0): VisualVariant => {
  if (byCategory[key]) return byCategory[key];
  const all = Object.keys(patterns) as VisualVariant[];
  return all[index % all.length] ?? 'grid';
};

export function Visual({ variant, className }: { variant: VisualVariant; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('absolute inset-0 bg-midnight', className)}>
      <div className={cn('absolute inset-0', patterns[variant])} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(5_14_28/0.75))]" />
    </div>
  );
}
