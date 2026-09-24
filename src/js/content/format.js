/** Formats et attributs linguistiques (français par défaut, arabe détecté). */
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const numberFormatters = new Map();

export const formatDate = (iso) => {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
};

export const formatNumber = (value, decimals = 0) => {
  if (!numberFormatters.has(decimals)) {
    numberFormatters.set(decimals, new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  }
  return numberFormatters.get(decimals).format(value);
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
export const isArabic = (text) => ARABIC.test(String(text ?? ''));

/** Attributs lang/dir pour un texte donné (à interpoler via raw()). */
export const langAttrs = (text) => (isArabic(text) ? ' lang="ar" dir="rtl"' : '');

export const initials = (name) =>
  String(name ?? '')
    .replace(/^(pr|dr|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

export const pad2 = (n) => String(n).padStart(2, '0');
