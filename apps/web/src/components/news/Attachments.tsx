import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Attachment } from '@fsbm/shared';
import { cn } from '../../lib/format';
import { Document, Download, Plus } from '../ui/Icons';
import { SmartLink } from '../ui/SmartLink';

interface AttachmentsProps {
  items: Attachment[];
  /** Titre de l'actualité, pour des libellés de liens explicites. */
  context: string;
  compact?: boolean;
  defaultOpen?: boolean;
}

/** Documents joints (listes PDF…) dans un volet repliable. */
export function Attachments({ items, context, compact = false, defaultOpen }: AttachmentsProps) {
  const [open, setOpen] = useState(defaultOpen ?? (!compact && items.length <= 3));
  const id = useId();
  const reduced = useReducedMotion();
  if (!items.length) return null;

  const label = `${items.length} document${items.length > 1 ? 's' : ''} joint${items.length > 1 ? 's' : ''}`;

  return (
    <div className={cn('border-t border-midnight/10', compact ? 'mt-4 pt-3' : 'mt-6 pt-4')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full cursor-pointer items-center gap-2.5 text-left text-[0.8125rem] font-medium text-midnight transition-colors hover:text-brand"
      >
        <Document className="size-4 text-brand" />
        {label}
        <Plus className={cn('ml-auto size-3.5 text-brand transition-transform duration-500', open && 'rotate-45')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={id}
            key="list"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn('grid grid-cols-2 gap-x-6 overflow-hidden text-[0.8125rem] text-muted', !compact && 'sm:grid-cols-3')}
          >
            {items.map((doc, i) => (
              <li key={`${doc.url}-${i}`} className={cn(i < (compact ? 2 : 3) && 'pt-3')}>
                <SmartLink href={doc.url} className="group flex items-center gap-2 py-1.5 transition-colors hover:text-midnight">
                  <Download className="size-3.5 shrink-0 text-brand" />
                  <span className="link-draw">{doc.label}</span>
                  <span className="sr-only"> — {context}</span>
                </SmartLink>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
