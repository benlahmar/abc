import { useEffect, useRef } from 'react';

/**
 * Raccourcis clavier d'une section. Ignorés pendant la saisie dans un champ et quand une boîte
 * de dialogue est ouverte.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest('input, select, textarea, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
      const handler = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (handler) { e.preventDefault(); handler(e); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
