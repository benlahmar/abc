import type { NavItem } from '../../lib/navigation';
import { cn } from '../../lib/format';
import { ArrowRight } from '../ui/Icons';
import { SmartLink } from '../ui/SmartLink';

interface MegaPanelProps {
  item: NavItem & { mega: NonNullable<NavItem['mega']> };
  open: boolean;
  onNavigate: () => void;
}

/** Panneau de méga-menu (toujours monté pour que aria-controls pointe vers un élément existant). */
export function MegaPanel({ item, open, onNavigate }: MegaPanelProps) {
  const { intro, columns, feature } = item.mega;
  return (
    <div
      id={`mega-${item.id}`}
      role="region"
      aria-label={item.label}
      inert={!open}
      className={cn(
        'on-dark absolute inset-x-0 top-full hidden border-t border-paper/10 bg-midnight-950 text-paper shadow-[0_40px_80px_-40px_rgb(5_14_28/0.8)] transition-[opacity,translate,visibility] duration-500 ease-out-expo xl:block',
        open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-3 opacity-0',
      )}
    >
      <div className="container-x grid grid-cols-12 gap-10 py-14">
        <div className={cn(columns.length === 1 ? 'col-span-4' : 'col-span-3', 'pr-8')}>
          <p className="eyebrow flex items-center gap-4 text-gold">
            <span aria-hidden="true" className="h-px w-10 bg-gold/60" />
            {intro.eyebrow}
          </p>
          <p className="display mt-6 text-[2.35rem] leading-[1.05]">{intro.title}</p>
          <p className="mt-5 text-sm leading-relaxed text-paper/60">{intro.text}</p>
          {intro.link && (
            <SmartLink href={intro.link.href} onClick={onNavigate} className="group mt-7 inline-flex items-center gap-2.5 text-sm font-medium text-gold">
              <span className="link-draw pb-0.5">{intro.link.label}</span>
              <ArrowRight className="size-3.5 transition-transform duration-500 group-hover:translate-x-1" />
            </SmartLink>
          )}
        </div>

        {columns.map((column) => (
          <div key={column.title} className={columns.length === 1 ? 'col-span-4' : 'col-span-3'}>
            <h3 className="eyebrow mb-4 text-paper/45">{column.title}</h3>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}>
                  <SmartLink
                    href={link.href}
                    onClick={onNavigate}
                    className="group flex items-center justify-between gap-4 border-b border-paper/10 py-3.5 text-[0.95rem] text-paper/80 transition-colors hover:text-paper"
                  >
                    {link.label}
                    <ArrowRight className="size-3.5 -translate-x-2 text-gold opacity-0 transition duration-500 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100" />
                  </SmartLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <aside className={cn('relative flex flex-col justify-between overflow-hidden border border-gold/25 p-8', columns.length === 1 ? 'col-span-4' : 'col-span-3')} aria-label={feature.eyebrow}>
          <div aria-hidden="true" className="absolute -top-24 -right-24 size-64 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <p className="eyebrow text-gold">{feature.eyebrow}</p>
            <p className="display mt-5 text-[1.65rem] leading-snug">{feature.title}</p>
          </div>
          <SmartLink href={feature.link.href} onClick={onNavigate} className="group relative mt-10 inline-flex items-center gap-2.5 border-t border-paper/10 pt-6 text-sm font-medium hover:text-gold">
            {feature.link.label}
            <ArrowRight className="size-3.5 text-gold transition-transform duration-500 group-hover:translate-x-1" />
          </SmartLink>
        </aside>
      </div>
    </div>
  );
}
