/** Toutes les dates du back-office sont exprimées à l'heure de Casablanca. */
export const TIME_ZONE = 'Africa/Casablanca';

const dateTime = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, dateStyle: 'long' });
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : '—');

const wallClock = (date: Date) => {
  const p = Object.fromEntries(parts.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, min: +p.minute! };
};

/** ISO → valeur d'un <input type="datetime-local"> à l'heure de Casablanca. */
export function toCasablancaInput(iso: string | null | undefined) {
  if (!iso) return '';
  const w = wallClock(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.min)}`;
}

/** Valeur datetime-local (heure de Casablanca) → ISO UTC, quel que soit le fuseau du navigateur. */
export function fromCasablancaInput(value: string) {
  if (!value) return null;
  const [date, time] = value.split('T');
  const [y, m, d] = date!.split('-').map(Number);
  const [h, min] = time!.split(':').map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, min!);
  const w = wallClock(new Date(guess));
  const offset = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min) - guess;
  return new Date(guess - offset).toISOString();
}

export const relative = (iso: string) => {
  const diff = (new Date(iso).getTime() - Date.now()) / 60_000;
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'minute');
  if (abs < 60 * 24) return rtf.format(Math.round(diff / 60), 'hour');
  return rtf.format(Math.round(diff / 1440), 'day');
};

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const fileSize = (bytes: number) => (bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1000))} Ko`);
