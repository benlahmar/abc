/**
 * N'autorise que les liens relatifs au site (/…, ./…, ../…), les ancres, http(s), mailto: et tel:.
 * Bloque javascript:, data:, et les URL relatives au protocole (//hote, /\hote).
 */
export function safeUrl(url: unknown, fallback = '#'): string {
  if (typeof url !== 'string' || !url.trim()) return fallback;
  const value = url.trim();
  if (/^(\/(?![/\\])|#|\.{1,2}\/)/.test(value)) return value;
  try {
    const { protocol } = new URL(value);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Vrai si le lien pointe vers le site lui-même (navigation interne). */
export const isInternalUrl = (url: string): boolean => /^\/(?![/\\])/.test(url);
