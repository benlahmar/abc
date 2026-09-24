import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import type { Site } from '@fsbm/shared';
import { primaryNav } from '../../lib/navigation';
import { Close, Lock, Plus } from '../ui/Icons';
import { SmartLink } from '../ui/SmartLink';

/** Menu mobile plein écran sur <dialog> natif (piège de focus, Échap, zone inerte en arrière-plan). */
export function MobileMenu({ open, onClose, site }: { open: boolean; onClose: () => void; site: Site | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) onClose();
    // Fermer après une navigation (volontairement déclenché par le seul changement de route).
  }, [pathname]);

  const item = (i: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, y: 24 }, animate: open ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }, transition: { duration: 0.7, delay: 0.08 + i * 0.05, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <dialog
      ref={ref}
      id="mobile-menu"
      aria-label="Menu du site"
      onClose={() => {
        document.documentElement.style.overflow = '';
        onClose();
      }}
      className="on-dark m-0 h-dvh max-h-none w-full max-w-none bg-midnight-950 p-0 text-paper backdrop:bg-midnight-950/60 xl:hidden"
    >
      <div className="relative flex h-full flex-col overflow-hidden">
        <div aria-hidden="true" className="absolute -top-40 -right-40 size-[28rem] rounded-full bg-gold/10 blur-3xl" />
        <div className="container-x relative flex h-20 shrink-0 items-center justify-between border-b border-paper/10">
          <img src="/images/logo-fsbm-blanc.webp" alt="Faculté des Sciences Ben M’Sik" width={408} height={230} className="h-12 w-auto" />
          <button type="button" onClick={onClose} className="grid size-10 place-items-center" autoFocus>
            <span className="sr-only">Fermer le menu</span>
            <Close className="size-5" />
          </button>
        </div>

        <nav aria-label="Navigation principale" className="container-x relative flex-1 overflow-y-auto py-6">
          <ul className="divide-y divide-paper/10">
            {primaryNav.map((entry, i) => (
              <motion.li key={entry.id} {...item(i)}>
                {entry.mega ? (
                  <details className="group" name="mobile-menu">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-serif text-[2rem] leading-none [&::-webkit-details-marker]:hidden">
                      {entry.label}
                      <Plus className="size-4 text-gold transition-transform duration-500 group-open:rotate-45" />
                    </summary>
                    <ul className="grid gap-3.5 pb-7 pl-1 text-[0.95rem] text-paper/70">
                      {entry.mega.columns.flatMap((c) => c.links).map((link) => (
                        <li key={link.href}>
                          <SmartLink href={link.href} className="hover:text-gold">
                            {link.label}
                          </SmartLink>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <SmartLink href={entry.href} className="block py-5 font-serif text-[2rem] leading-none transition-colors hover:text-gold">
                    {entry.label}
                  </SmartLink>
                )}
              </motion.li>
            ))}
          </ul>
          {site && (
            <ul className="mt-10 grid gap-2 text-[0.875rem] text-paper/55">
              <li><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></li>
              <li><a href={`tel:${site.contact.phone}`}>{site.contact.phoneDisplay}</a></li>
            </ul>
          )}
        </nav>

        <div className="container-x relative shrink-0 border-t border-paper/10 py-5">
          <SmartLink href="/portail-etudiant" className="flex w-full items-center justify-center gap-2.5 bg-gold py-4 text-sm font-medium text-midnight-950">
            <Lock className="size-3.5" /> Portail Étudiant
          </SmartLink>
        </div>
      </div>
    </dialog>
  );
}
