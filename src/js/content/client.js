/**
 * Source de contenu.
 *
 * Par défaut, chaque collection est lue depuis /data/<nom>.json (dossier public/data).
 * Quand le back-office sera en ligne, définir VITE_CONTENT_API_URL (ex. https://api.fsbm.ma/v1)
 * dans .env : les collections seront alors chargées depuis <API>/<nom>, sans autre changement.
 */
const API_URL = (import.meta.env.VITE_CONTENT_API_URL ?? '').replace(/\/+$/, '');
const TIMEOUT_MS = 10_000;
const cache = new Map();

const endpoint = (name) => (API_URL ? `${API_URL}/${name}` : `${import.meta.env.BASE_URL}data/${name}.json`);

export function getCollection(name) {
  if (!cache.has(name)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const request = fetch(endpoint(name), { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Contenu « ${name} » indisponible (HTTP ${res.status})`);
        return res.json();
      })
      .finally(() => clearTimeout(timer));
    // Un échec n'est pas mis en cache : un nouvel appel retentera la requête.
    request.catch(() => cache.delete(name));
    cache.set(name, request);
  }
  return cache.get(name);
}
