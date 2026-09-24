import { getCollection } from '../content/client.js';
import { html, mount, raw, safeUrl } from '../content/template.js';

/** Identité et coordonnées de la faculté (site.json). */
const ICONS = {
  facebook: '<path d="M9 14V8.6h1.8l.3-2.1H9V5.2c0-.6.2-1 1-1h1.1V2.4c-.2 0-.9-.1-1.6-.1C7.9 2.3 7 3.3 7 5v1.5H5.2v2.1H7V14z" fill="currentColor"/>',
  twitter: '<path d="M2.6 2.5h3.1l7.7 11H10.3zM13 2.5 9.1 7M6.9 9l-4 4.5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  linkedin: '<rect x="2.5" y="6" width="2.2" height="7.5" fill="currentColor"/><circle cx="3.6" cy="3.6" r="1.3" fill="currentColor"/><path d="M6.8 6h2.1v1.1c.4-.7 1.2-1.3 2.4-1.3 2 0 2.4 1.3 2.4 3v4.7h-2.2V9.4c0-1-.1-1.8-1.1-1.8s-1.4.8-1.4 1.8v4.1H6.8z" fill="currentColor"/>',
  youtube: '<rect x="1.5" y="3.5" width="13" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m6.8 6 3.4 2-3.4 2z" fill="currentColor"/>',
  instagram: '<rect x="2" y="2" width="12" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2.7" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="11.6" cy="4.4" r=".8" fill="currentColor"/>',
};

const read = (obj, path) => path.split('.').reduce((node, key) => node?.[key], obj);

/** Remplace le texte des éléments [data-bind="chemin"] et les liens [data-bind-href="schéma:chemin"]. */
export async function bindSite() {
  const site = await getCollection('site');
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const value = read(site, el.dataset.bind);
    if (typeof value === 'string' && value) el.textContent = value;
  });
  document.querySelectorAll('[data-bind-href]').forEach((el) => {
    const [scheme, path] = el.dataset.bindHref.split(':');
    const value = read(site, path);
    if (typeof value === 'string' && value) el.setAttribute('href', `${scheme}:${value.replace(/\s+/g, '')}`);
  });
}

export async function renderSocials(el) {
  const { socials = [] } = await getCollection('site');
  mount(
    el,
    socials.map(
      (s) => html`<li>
        <a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer" class="grid size-7 place-items-center transition-colors hover:text-gold">
          <svg aria-hidden="true" viewBox="0 0 16 16" class="size-3.5">${raw(ICONS[s.network] ?? ICONS.linkedin)}</svg>
          <span class="sr-only">${s.label} (nouvel onglet)</span>
        </a>
      </li>`,
    ),
  );
}

export async function renderAddress(el) {
  const { contact } = await getCollection('site');
  if (!contact?.address?.length) return;
  mount(el, contact.address.map((line, i) => html`${i ? raw('<br />') : ''}${line}`));
}
