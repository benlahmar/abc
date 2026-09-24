import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatches } from 'react-router';
import { primaryNav, type NavItem } from '../../lib/navigation';
import { useMediaQuery, useScrolled } from '../../lib/hooks';
import { useCollection } from '../../lib/queries';
import { cn } from '../../lib/format';
import { ChevronDown, Lock, Mail, Phone, Search, socialIcons } from '../ui/Icons';
import { SmartLink } from '../ui/SmartLink';
import { Brand } from './Brand';
import { MegaPanel } from './MegaPanel';
import { MobileMenu } from './MobileMenu';

type MegaItem = NavItem & { mega: NonNullable<NavItem['mega']> };
const hasMega = (item: NavItem): item is MegaItem => Boolean(item.mega);

const HOVER_OPEN = 120;
const HOVER_CLOSE = 240;

/**
 * En-tête fixe : transparent sur le hero de l'accueil, verre dépoli clair ailleurs ou après défilement.
 * Méga-menus au modèle « disclosure » WAI-ARIA (clic, clavier, survol avec intention).
 */
export function Header() {
  const { pathname } = useLocation();
  const scrolled = useScrolled(40);
  const desktop = useMediaQuery('(min-width: 80rem)');
  const { data: site } = useCollection('site');
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const timers = useRef<{ open?: number; close?: number }>({});
  const hoverOpenedAt = useRef(0);

  const matches = useMatches();
  const overlay = matches.some((match) => (match.handle as { darkHero?: boolean } | undefined)?.darkHero);
  const solid = !overlay || scrolled || openId !== null;

  const openRef = useRef<string | null>(null);
  openRef.current = openId;

  const close = useCallback((returnFocus = false) => {
    window.clearTimeout(timers.current.open);
    const current = openRef.current;
    setOpenId(null);
    if (returnFocus && current) triggers.current.get(current)?.focus();
  }, []);

  useEffect(() => close(), [pathname, close]);
  useEffect(() => {
    if (!desktop) close();
  }, [desktop, close]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(headerRef.current?.contains(document.activeElement) ?? false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [openId, close]);

  const megaItems = primaryNav.filter(hasMega);
  const triggerIds = primaryNav.map((item) => item.id);

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLElement>, item: NavItem) => {
    const index = triggerIds.indexOf(item.id);
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (move) {
      event.preventDefault();
      const nextId = triggerIds[(index + move + triggerIds.length) % triggerIds.length]!;
      const target = headerRef.current?.querySelector<HTMLElement>(`[data-nav-id="${nextId}"]`);
      target?.focus();
      if (openId) setOpenId(primaryNav.find((i) => i.id === nextId)?.mega ? nextId : null);
    } else if (event.key === 'ArrowDown' && hasMega(item)) {
      event.preventDefault();
      setOpenId(item.id);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`#mega-${item.id} a`)?.focus());
    }
  };

  return (
    <>
      <header
        ref={headerRef}
        onPointerEnter={() => window.clearTimeout(timers.current.close)}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse') return;
          window.clearTimeout(timers.current.open);
          timers.current.close = window.setTimeout(() => close(), HOVER_CLOSE);
        }}
        onBlur={(event) => {
          if (openId && !event.currentTarget.contains(event.relatedTarget as Node)) close();
        }}
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,color,box-shadow] duration-500 ease-out-expo',
          solid
            ? 'bg-paper/85 text-midnight shadow-[0_1px_0_rgb(10_25_47/0.08),0_18px_40px_-28px_rgb(10_25_47/0.35)] backdrop-blur-xl'
            : 'on-dark text-paper',
        )}
      >
        {/* Barre de contact : se replie au défilement */}
        <div className={cn('hidden transition-[grid-template-rows] duration-500 ease-out-expo md:grid', scrolled ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
          <div className="overflow-hidden">
            <div className={cn('border-b transition-colors duration-500', solid ? 'border-midnight/10' : 'border-paper/10')}>
              <div className={cn('container-x flex h-10 items-center justify-between text-[0.75rem]', solid ? 'text-midnight/70' : 'text-paper/70')}>
                <ul className="flex items-center gap-7" aria-label="Coordonnées">
                  <li>
                    <a href={`mailto:${site?.contact.email ?? 'fsbm.contact@univh2c.ma'}`} className="flex items-center gap-2 transition-colors hover:text-gold">
                      <Mail className="size-3.5" />
                      {site?.contact.email ?? 'fsbm.contact@univh2c.ma'}
                    </a>
                  </li>
                  <li>
                    <a href={`tel:${site?.contact.phone ?? '+212661442427'}`} className="flex items-center gap-2 transition-colors hover:text-gold">
                      <Phone className="size-3.5" />
                      {site?.contact.phoneDisplay ?? '(+212) 6 61 44 24 27'}
                    </a>
                  </li>
                </ul>
                <div className="flex items-center gap-6">
                  <Link to="/contact" className="link-draw transition-colors hover:text-gold">
                    Contact
                  </Link>
                  <ul className={cn('flex items-center gap-1 border-l pl-5', solid ? 'border-midnight/15' : 'border-paper/15')} aria-label="Réseaux sociaux">
                    {site?.socials.map((social) => {
                      const Icon = socialIcons[social.network];
                      return (
                        <li key={social.network}>
                          <SmartLink href={social.url} className="grid size-7 place-items-center transition-colors hover:text-gold" aria-label={social.label}>
                            <Icon className="size-3.5" />
                          </SmartLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn('container-x flex items-center justify-between gap-4 transition-[height] duration-500 ease-out-expo sm:gap-6', scrolled ? 'h-[4.5rem]' : 'h-20 xl:h-24')}>
          <Brand tone={solid ? 'light' : 'dark'} />

          <nav aria-label="Navigation principale" className="hidden h-full xl:block">
            <ul className="flex h-full items-stretch">
              {primaryNav.map((item) => {
                const open = openId === item.id;
                const itemClass = cn(
                  'relative flex h-full cursor-pointer items-center gap-1.5 px-3 text-[0.8125rem] font-medium tracking-wide whitespace-nowrap transition-colors 2xl:px-4 2xl:text-[0.875rem]',
                  'after:absolute after:inset-x-3 after:bottom-5 after:h-px after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-500 after:ease-out-expo hover:after:scale-x-100 2xl:after:inset-x-4',
                  open && 'after:scale-x-100',
                  solid ? 'text-midnight/75 hover:text-midnight' : 'text-paper/80 hover:text-paper',
                  open && (solid ? 'text-midnight' : 'text-paper'),
                );
                return (
                  <li key={item.id} className="flex">
                    {hasMega(item) ? (
                      <button
                        type="button"
                        data-nav-id={item.id}
                        ref={(el) => {
                          if (el) triggers.current.set(item.id, el);
                        }}
                        aria-expanded={open}
                        aria-controls={`mega-${item.id}`}
                        className={itemClass}
                        onClick={() => {
                          if (open && performance.now() - hoverOpenedAt.current > 450) setOpenId(null);
                          else setOpenId(item.id);
                        }}
                        onKeyDown={(event) => onTriggerKeyDown(event, item)}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== 'mouse') return;
                          window.clearTimeout(timers.current.close);
                          window.clearTimeout(timers.current.open);
                          timers.current.open = window.setTimeout(
                            () => {
                              if (openId !== item.id) hoverOpenedAt.current = performance.now();
                              setOpenId(item.id);
                            },
                            openId ? 0 : HOVER_OPEN,
                          );
                        }}
                        onPointerLeave={() => window.clearTimeout(timers.current.open)}
                      >
                        {item.label}
                        <ChevronDown className={cn('size-3 opacity-60 transition-transform duration-300', open && 'rotate-180')} />
                      </button>
                    ) : (
                      <Link
                        to={item.href}
                        data-nav-id={item.id}
                        className={itemClass}
                        onKeyDown={(event) => onTriggerKeyDown(event, item)}
                        onPointerEnter={() => {
                          window.clearTimeout(timers.current.open);
                          if (openId) setOpenId(null);
                        }}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1 sm:gap-3">
            <Link to="/recherche-site" className="grid size-10 place-items-center opacity-80 transition-opacity hover:opacity-100" aria-label="Rechercher sur le site">
              <Search className="size-[1.125rem]" />
            </Link>
            <Link
              to="/portail-etudiant"
              className={cn(
                'group relative hidden items-center gap-2.5 overflow-hidden border px-5 py-3 text-[0.8125rem] font-medium tracking-wide whitespace-nowrap transition-colors duration-500 sm:inline-flex',
                solid ? 'border-brand/70 text-brand hover:text-paper' : 'border-paper/40 hover:border-paper hover:text-midnight-950',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('absolute inset-0 -z-10 origin-bottom scale-y-0 transition-transform duration-700 ease-out-expo group-hover:scale-y-100', solid ? 'bg-brand' : 'bg-paper')}
              />
              <Lock className={cn('size-3.5 transition-colors', solid ? 'text-brand group-hover:text-paper' : 'text-paper/80 group-hover:text-brand')} />
              Portail Étudiant
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              className="grid size-10 place-items-center xl:hidden"
            >
              <span className="sr-only">Ouvrir le menu</span>
              <span aria-hidden="true" className="flex w-6 flex-col items-end gap-[5px]">
                <span className="block h-px w-6 bg-current" />
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-6 bg-current" />
              </span>
            </button>
          </div>
        </div>

        {megaItems.map((item) => (
          <MegaPanel key={item.id} item={item} open={openId === item.id} onNavigate={() => close()} />
        ))}
      </header>

      <div
        aria-hidden="true"
        onClick={() => close()}
        className={cn(
          'fixed inset-0 z-40 bg-midnight-950/40 backdrop-blur-[2px] transition-opacity duration-500',
          openId ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} site={site} />
    </>
  );
}
