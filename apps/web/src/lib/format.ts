const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const numberFormats = new Map<number, Intl.NumberFormat>();

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

export const formatDate = (iso: string) => {
  const date = toDate(iso);
  return Number.isNaN(date.getTime()) ? '' : longDate.format(date);
};

/** Découpe une date pour les blocs « 15 / sept. / 2026 ». */
export const dateParts = (iso: string) => {
  const date = toDate(iso);
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: shortMonth.format(date).replace('.', ''),
    year: String(date.getFullYear()),
  };
};

export const formatNumber = (value: number, decimals = 0) => {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

/** Attributs lang/dir pour un texte : l'arabe est affiché de droite à gauche. */
export const langProps = (text: string | undefined): { lang?: string; dir?: 'rtl' } =>
  text && ARABIC.test(text) ? { lang: 'ar', dir: 'rtl' } : {};

export const initials = (name: string) =>
  name
    .replace(/^(pr|dr|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
