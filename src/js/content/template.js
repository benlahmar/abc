/**
 * Mini moteur de gabarits sûr : toute valeur interpolée est échappée,
 * sauf si elle est explicitement marquée avec raw(). Indispensable dès que le
 * contenu provient d'un back-office.
 */
class Raw {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

export const raw = (value) => new Raw(value);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const serialize = (value) => {
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(serialize).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
};

export function html(strings, ...values) {
  let out = '';
  strings.forEach((chunk, i) => {
    out += chunk + (i < values.length ? serialize(values[i]) : '');
  });
  return raw(out);
}

/** N'autorise que les liens relatifs, ancres, http(s), mailto: et tel:. */
export function safeUrl(url, fallback = '#') {
  if (typeof url !== 'string' || !url.trim()) return fallback;
  const value = url.trim();
  if (/^(\/(?![\/\\])|#|\.{1,2}\/)/.test(value)) return value;
  try {
    const { protocol } = new URL(value);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function mount(el, template) {
  el.innerHTML = serialize(template);
  el.removeAttribute('aria-busy');
  return el;
}
