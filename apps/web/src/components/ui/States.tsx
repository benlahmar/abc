import { cn } from '../../lib/format';

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden="true" className={cn('skeleton', className)} />;

export function ErrorNote({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  return (
    <div role="status" className={cn('col-span-full border border-dashed border-current/20 p-8 text-center text-sm opacity-80', className)}>
      Ce contenu est momentanément indisponible.
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-medium underline decoration-gold underline-offset-4">
          Réessayer
        </button>
      )}
    </div>
  );
}
