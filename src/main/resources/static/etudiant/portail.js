/*
 * Portail étudiant : connexion OIDC (authorization code + PKCE) auprès du SSO de l'université,
 * puis appels à l'API avec le jeton de l'étudiant. Exemple d'intégration pour l'ENT ou une autre appli.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = sessionStorage;
  let config, oidc, token;

  const STATUS = {
    SIGNED: ['Signé', 'ok'], REVOKED: ['Révoqué', 'ko'], PENDING_APPROVAL: ['En cours de validation', 'warn'],
    PENDING: ['En attente du service', 'warn'], FULFILLED: ['Traitée', 'ok'], REJECTED: ['Refusée', 'ko'],
    FAILED: ['Non aboutie', 'ko'],
  };

  // ------------------------------------------------------------------ OIDC

  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
  const redirectUri = () => location.origin + location.pathname;

  async function login() {
    const verifier = random();
    const state = random();
    store.setItem('pkce', JSON.stringify({ verifier, state }));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const params = new URLSearchParams({
      response_type: 'code', client_id: config.clientId, redirect_uri: redirectUri(),
      scope: 'openid profile', state, code_challenge: challenge, code_challenge_method: 'S256',
    });
    location.assign(oidc.authorization_endpoint + '?' + params);
  }

  async function tokenRequest(body) {
    const res = await fetch(oidc.token_endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, ...body }),
    });
    if (!res.ok) throw new Error('Connexion refusée par le serveur d\'identité');
    const t = await res.json();
    token = t;
    store.setItem('token', JSON.stringify(t));
    return t;
  }

  async function handleCallback() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code')) return false;
    const saved = JSON.parse(store.getItem('pkce') || '{}');
    store.removeItem('pkce');
    history.replaceState(null, '', redirectUri());
    if (!saved.state || saved.state !== q.get('state')) throw new Error('Réponse de connexion invalide');
    await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(),
      code_verifier: saved.verifier });
    return true;
  }

  async function refresh() {
    if (!token?.refresh_token) return false;
    try {
      await tokenRequest({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
      return true;
    } catch { return false; }
  }

  function logout() {
    const idToken = token?.id_token;
    store.clear();
    const params = new URLSearchParams({ client_id: config.clientId, post_logout_redirect_uri: redirectUri() });
    if (idToken) params.set('id_token_hint', idToken);
    location.assign(oidc.end_session_endpoint ? oidc.end_session_endpoint + '?' + params : redirectUri());
  }

  // ------------------------------------------------------------------ API

  async function api(path, options = {}, retry = true) {
    const res = await fetch(path, { ...options, headers: { ...(options.headers || {}),
      Authorization: 'Bearer ' + token.access_token } });
    if (res.status === 401 && retry && await refresh()) return api(path, options, false);
    if (res.status === 401) { store.removeItem('token'); await login(); throw new Error('Session expirée'); }
    if (!res.ok) {
      let detail = 'Erreur ' + res.status;
      try { const p = await res.json(); detail = p.detail || detail;
        if (p.errors) detail += ' : ' + p.errors.map((e) => e.field + ' ' + e.message).join(', '); } catch { /* */ }
      throw new Error(detail);
    }
    return res;
  }

  // ------------------------------------------------------------------ affichage

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '';
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => (k === 'class' ? (e.className = v) : e.setAttribute(k, v)));
    children.flat().forEach((c) => c != null && e.append(c));
    return e;
  }
  const badge = (status) => { const [label, cls] = STATUS[status] || [status, 'warn'];
    return el('span', { class: 'badge ' + cls }, label); };
  function flash(message, kind = 'ok') {
    const f = $('flash'); f.className = kind; f.textContent = message;
  }

  async function download(doc) {
    const res = await api(doc.downloadUrl);
    const url = URL.createObjectURL(await res.blob());
    const a = el('a', { href: url, download: doc.type.toLowerCase() + '-' + doc.academicYear
      + (doc.semester ? '-' + doc.semester : '') + '.pdf' });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  async function loadDocuments() {
    const docs = await (await api('/api/v1/me/documents')).json();
    $('docs').replaceChildren(...docs.map((d) => {
      const dl = d.downloadUrl ? el('button', { type: 'button', class: 'secondary' }, 'Télécharger') : null;
      if (dl) dl.addEventListener('click', () => download(d).catch((e) => flash(e.message, 'ko')));
      return el('li', {},
        el('div', {},
          el('div', { class: 'title' }, d.label, badge(d.status)),
          el('div', { class: 'sub' }, d.academicYear + (d.semester ? ' · ' + d.semester : '')
            + (d.signedAt ? ' · signé le ' + fmtDate(d.signedAt) : '')
            + (d.verificationCode ? ' · réf. ' + d.verificationCode : '')
            + (d.revocationReason ? ' · ' + d.revocationReason : ''))),
        dl);
    }));
    $('docs-empty').hidden = docs.length > 0;
  }

  async function loadRequests() {
    const reqs = await (await api('/api/v1/me/requests')).json();
    $('reqs').replaceChildren(...reqs.map((r) => el('li', {},
      el('div', {},
        el('div', { class: 'title' }, r.label, badge(r.status)),
        el('div', { class: 'sub' }, r.academicYear + (r.semester ? ' · ' + r.semester : '')
          + ' · demandé le ' + fmtDate(r.createdAt) + (r.message ? ' · ' + r.message : ''))))));
    $('reqs-empty').hidden = reqs.length > 0;
  }

  function setupRequestForm(profile) {
    if (!profile.documentTypes.length) return;
    $('request-card').hidden = false;
    const type = $('req-type');
    type.replaceChildren(...profile.documentTypes.map((o) => el('option', { value: o.type }, o.label)));
    const now = new Date();
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    $('req-year').value = start + '-' + (start + 1);
    const sync = () => {
      const offer = profile.documentTypes.find((o) => o.type === type.value);
      $('semester-field').hidden = type.value !== 'RELEVE_NOTES';
      $('mode-hint').textContent = offer.mode === 'AUTO'
        ? 'Le document est produit immédiatement à partir des données d\'Apogée.'
        : 'La demande est transmise au service de scolarité ; le document apparaîtra ici une fois établi.';
    };
    type.addEventListener('change', sync); sync();

    $('request-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const body = { type: f.get('type'), academicYear: f.get('academicYear'),
        semester: f.get('type') === 'RELEVE_NOTES' ? f.get('semester') : null, purpose: f.get('purpose') || null };
      try {
        const r = await (await api('/api/v1/me/requests', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
        if (r.status === 'FULFILLED') flash('Document établi : il est disponible dans « Mes documents ».');
        else if (r.status === 'FAILED') flash(r.message, 'ko');
        else flash('Demande transmise au service de scolarité.');
        await Promise.all([loadDocuments(), loadRequests()]);
      } catch (e) { flash(e.message, 'ko'); }
    });
  }

  // ------------------------------------------------------------------ démarrage

  async function start() {
    config = await (await fetch('config.json')).json();
    $('univ').textContent = config.faculty;
    $('fac').textContent = config.university;
    if (config.logoUrl) { $('logo').src = config.logoUrl; $('logo').alt = config.shortName || ''; $('logo').hidden = false; }
    document.title = 'Mes documents — ' + (config.shortName || config.faculty);
    oidc = await (await fetch(config.issuer + '/.well-known/openid-configuration')).json();
    $('login-btn').addEventListener('click', login);
    $('logout').addEventListener('click', logout);

    token = JSON.parse(store.getItem('token') || 'null');
    await handleCallback();
    if (!token) {
      // Arrivée depuis l'ENT (session SSO déjà ouverte) : connexion transparente
      if (new URLSearchParams(location.search).has('sso')) return login();
      $('login').hidden = false;
      return;
    }
    const profile = await (await api('/api/v1/me')).json();
    $('student').textContent = profile.name + ' · ' + profile.cne;
    $('who').hidden = false;
    $('app').hidden = false;
    setupRequestForm(profile);
    await Promise.all([loadDocuments(), loadRequests()]);
  }

  start().catch((e) => {
    $('app').hidden = false;
    flash(e.message === 'Failed to fetch' ? 'Service indisponible' : e.message, 'ko');
  });
})();
