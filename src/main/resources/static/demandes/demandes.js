/*
 * Application « Mes documents officiels » : demandes d'attestations et de relevés par l'étudiant.
 * Connexion OIDC (code + PKCE) au SSO de l'université, puis API /api/v1/me.
 * Mode démo (?demo, ou fichier ouvert hors serveur) : données d'exemple, aucune requête réseau.
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const store = sessionStorage;
  const DELAI_ENVOI = 5; // secondes pendant lesquelles une demande peut être annulée

  const TYPES = {
    ATTESTATION_SCOLARITE: {
      titre: 'Attestation de scolarité',
      aide: 'Prouve votre inscription pour une année universitaire.',
    },
    RELEVE_NOTES: {
      titre: 'Relevé de notes',
      aide: 'Les notes validées d\'un semestre.',
    },
  };
  const USAGES = {
    '': 'Usage non précisé',
    ETRANGER: 'Dossier pour l\'étranger',
    INSCRIPTION: 'Inscription dans un autre établissement',
    STAGE: 'Stage ou emploi',
    BOURSE: 'Bourse',
  };
  const ETATS = {
    SIGNED: { texte: 'Prêt', classe: 'pret', groupe: 'prets' },
    PENDING_APPROVAL: { texte: 'En validation', classe: 'cours', groupe: 'cours' },
    PENDING: { texte: 'Demandé', classe: 'cours', groupe: 'cours' },
    REVOKED: { texte: 'Annulé par la faculté', classe: 'clos', groupe: 'clos' },
    REJECTED: { texte: 'Refusé', classe: 'clos', groupe: 'clos' },
    FAILED: { texte: 'Non abouti', classe: 'clos', groupe: 'clos' },
  };

  const etat = {
    demo: false,
    profil: null,
    documents: [],
    demandes: [],
    filtre: 'tout',
    recherche: '',
    selection: null, // clé de l'élément affiché
    mode: 'vue',     // 'vue' | 'demande'
    cachetsPoses: new Set(),
  };
  let config;
  let oidc;
  let jeton;

  // ================================================================ utilitaires

  function el(tag, attrs = {}, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of enfants.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  const dateLongue = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const dateHeure = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const anneeCourante = () => { const d = new Date(); const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return `${a}-${a + 1}`; };
  const anneesProposees = () => { const a = Number(anneeCourante().slice(0, 4)); return [0, 1, 2, 3, 4].map((i) => `${a - i}-${a - i + 1}`); };

  function toast(texte, { erreur = false, action, duree = 5000 } = {}) {
    const t = el('div', { class: 'toast' + (erreur ? ' toast-erreur' : ''), role: erreur ? 'alert' : 'status' }, el('span', {}, texte));
    if (action) t.append(el('button', { type: 'button', class: 'lien', onclick: () => { action.faire(); t.remove(); } }, action.texte));
    $('#toasts').append(t);
    if (duree) setTimeout(() => t.remove(), duree);
    return t;
  }

  function bandeau(texte, reessayer) {
    $('#bandeau-texte').textContent = texte;
    const b = $('#bandeau-action');
    b.hidden = !reessayer;
    b.onclick = () => { $('#bandeau').hidden = true; reessayer(); };
    $('#bandeau').hidden = false;
  }

  // ================================================================ connexion OIDC

  const b64url = (o) => btoa(String.fromCharCode(...new Uint8Array(o))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const alea = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
  const retourUri = () => location.origin + location.pathname;

  async function seConnecter() {
    const verifier = alea();
    const state = alea();
    store.setItem('pkce', JSON.stringify({ verifier, state }));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    location.assign(oidc.authorization_endpoint + '?' + new URLSearchParams({
      response_type: 'code', client_id: config.clientId, redirect_uri: retourUri(), scope: 'openid profile',
      state, code_challenge: challenge, code_challenge_method: 'S256',
    }));
  }

  async function demanderJeton(corps) {
    const r = await fetch(oidc.token_endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, ...corps }),
    });
    if (!r.ok) throw new Error('La connexion a été refusée par le service d\'identité de l\'université.');
    jeton = await r.json();
    store.setItem('jeton', JSON.stringify(jeton));
  }

  async function retourConnexion() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code')) return;
    const pkce = JSON.parse(store.getItem('pkce') || '{}');
    store.removeItem('pkce');
    history.replaceState(null, '', retourUri());
    if (!pkce.state || pkce.state !== q.get('state')) throw new Error('Réponse de connexion invalide : reconnectez-vous.');
    await demanderJeton({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: retourUri(), code_verifier: pkce.verifier });
  }

  function seDeconnecter() {
    if (etat.demo) { location.assign(retourUri()); return; }
    const idToken = jeton && jeton.id_token;
    store.clear();
    const p = new URLSearchParams({ client_id: config.clientId, post_logout_redirect_uri: retourUri() });
    if (idToken) p.set('id_token_hint', idToken);
    location.assign(oidc.end_session_endpoint ? oidc.end_session_endpoint + '?' + p : retourUri());
  }

  async function api(chemin, options = {}, nouvelEssai = true) {
    const r = await fetch(chemin, { ...options, headers: { ...(options.headers || {}), Authorization: 'Bearer ' + jeton.access_token } });
    if (r.status === 401 && nouvelEssai && jeton.refresh_token) {
      try { await demanderJeton({ grant_type: 'refresh_token', refresh_token: jeton.refresh_token }); } catch { /* reconnexion */ }
      return api(chemin, options, false);
    }
    if (r.status === 401) { store.removeItem('jeton'); await seConnecter(); throw new Error('Session expirée'); }
    if (!r.ok) {
      let detail = `Le service a répondu ${r.status}.`;
      try {
        const p = await r.json();
        detail = p.detail || detail;
        if (p.errors) detail += ' ' + p.errors.map((e) => e.message).join(', ');
      } catch { /* corps non JSON */ }
      const err = new Error(detail);
      err.status = r.status;
      throw err;
    }
    return r;
  }

  // ================================================================ données (API ou démonstration)

  const source = {
    async profil() { return etat.demo ? demo.profil : (await api('/api/v1/me')).json(); },
    async documents() { return etat.demo ? demo.documents : (await api('/api/v1/me/documents')).json(); },
    async demandes() { return etat.demo ? demo.demandes : (await api('/api/v1/me/requests')).json(); },
    async envoyer(corps) {
      if (!etat.demo) {
        return (await api('/api/v1/me/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })).json();
      }
      const d = { id: 'demo-' + Date.now(), type: corps.type, label: TYPES[corps.type].titre, academicYear: corps.academicYear,
        semester: corps.semester, status: 'PENDING', message: null, documentId: null, createdAt: new Date().toISOString(), handledAt: null };
      demo.demandes.unshift(d);
      return d;
    },
    async telecharger(doc) {
      if (etat.demo) { toast('Mode démonstration : le PDF signé serait téléchargé ici.'); return; }
      const r = await api(doc.downloadUrl);
      const url = URL.createObjectURL(await r.blob());
      const a = el('a', { href: url, download: `${doc.type.toLowerCase()}-${doc.academicYear}${doc.semester ? '-' + doc.semester : ''}.pdf` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Document téléchargé.');
    },
  };

  async function charger() {
    const liste = $('#liste');
    liste.setAttribute('aria-busy', 'true');
    try {
      const [documents, demandes] = await Promise.all([source.documents(), source.demandes()]);
      etat.documents = documents;
      etat.demandes = demandes;
    } finally {
      liste.setAttribute('aria-busy', 'false');
    }
  }

  /** Registre : documents (hors refusés) + demandes non encore transformées en document. */
  function entrees() {
    const docs = etat.documents.filter((d) => d.status !== 'REJECTED').map((d) => ({
      cle: 'doc:' + d.id, nature: 'document', type: d.type, annee: d.academicYear, semestre: d.semester,
      statut: d.status, date: d.signedAt || d.createdAt, ref: d.verificationCode, doc: d,
    }));
    const dems = etat.demandes.filter((r) => r.status !== 'FULFILLED').map((r) => ({
      cle: 'dem:' + r.id, nature: 'demande', type: r.type, annee: r.academicYear, semestre: r.semester,
      statut: r.status, date: r.createdAt, demande: r,
    }));
    return [...docs, ...dems].sort((a, b) => b.annee.localeCompare(a.annee) || (b.date || '').localeCompare(a.date || ''));
  }

  function correspond(e) {
    if (etat.filtre !== 'tout' && ETATS[e.statut].groupe !== etat.filtre) return false;
    const q = etat.recherche.trim().toLowerCase();
    if (!q) return true;
    const texte = [TYPES[e.type].titre, e.annee, e.semestre, ETATS[e.statut].texte, e.ref].join(' ').toLowerCase();
    return q.split(/\s+/).every((mot) => texte.includes(mot));
  }

  // ================================================================ registre

  function afficherRegistre() {
    const toutes = entrees();
    $('#compte-prets').textContent = `(${toutes.filter((e) => ETATS[e.statut].groupe === 'prets').length})`;
    $('#compte-cours').textContent = `(${toutes.filter((e) => ETATS[e.statut].groupe === 'cours').length})`;
    const visibles = toutes.filter(correspond);
    const liste = $('#liste');
    liste.replaceChildren();

    if (!toutes.length) {
      liste.append(el('p', { class: 'vide-liste' }, 'Vous n\'avez encore aucun document.'));
      return;
    }
    if (!visibles.length) {
      liste.append(el('p', { class: 'vide-liste' }, 'Aucun document ne correspond. ',
        el('button', { type: 'button', class: 'lien', onclick: reinitialiserFiltres }, 'Tout afficher')));
      return;
    }
    let anneeAffichee = null;
    for (const e of visibles) {
      if (e.annee !== anneeAffichee) {
        anneeAffichee = e.annee;
        liste.append(el('div', { class: 'annee', role: 'presentation' }, 'Année ' + e.annee));
      }
      const info = ETATS[e.statut];
      const signe = e.nature === 'document' && e.doc.signedAt;
      const detail = [e.semestre ? 'Semestre ' + e.semestre.slice(1) : null,
        signe ? 'signé le ' + dateLongue(e.doc.signedAt) : 'demandé le ' + dateLongue(e.date)]
        .filter(Boolean).join(', ');
      liste.append(el('div', {
        class: 'ligne', role: 'option', id: 'l-' + e.cle.replace(':', '-'), 'data-cle': e.cle,
        'aria-selected': String(e.cle === etat.selection), onclick: () => selectionner(e.cle, true),
      },
      el('span', { class: 'ligne-titre' }, TYPES[e.type].titre),
      el('span', { class: 'etat etat-' + info.classe }, info.texte),
      el('span', { class: 'ligne-detail' }, detail)));
    }
    if (etat.selection) liste.setAttribute('aria-activedescendant', 'l-' + etat.selection.replace(':', '-'));
  }

  function reinitialiserFiltres() {
    etat.filtre = 'tout';
    etat.recherche = '';
    $('#recherche').value = '';
    document.querySelectorAll('.filtre').forEach((f) => f.setAttribute('aria-checked', String(f.dataset.filtre === 'tout')));
    afficherRegistre();
  }

  function selectionner(cle, depuisClic = false) {
    etat.selection = cle;
    etat.mode = 'vue';
    document.querySelectorAll('.ligne').forEach((l) => l.setAttribute('aria-selected', String(l.dataset.cle === cle)));
    $('#liste').setAttribute('aria-activedescendant', 'l-' + cle.replace(':', '-'));
    $('#atelier').classList.add('consultation');
    afficherPlan();
    if (depuisClic && matchMedia('(max-width: 760px)').matches) $('#feuille').focus();
  }

  // ================================================================ la feuille

  function cachet(type, poser) {
    const textes = {
      signe: ['SIGNÉ', 'électroniquement'],
      attente: ['EN ATTENTE', 'de signature'],
      annule: ['ANNULÉ', 'par la faculté'],
    }[type];
    // Texte circulaire du tampon : université et faculté, comme sur un cachet réel
    const univ = [config.faculty, config.city].filter(Boolean).join(' · ').toUpperCase();
    const pointille = type === 'attente' ? ' stroke-dasharray="5 6"' : '';
    return el('div', { class: `cachet cachet-${type === 'signe' ? 'signe' : type}${poser ? ' cachet-pose' : ''}`, 'aria-hidden': 'true',
      html: `<svg viewBox="0 0 200 200">
        <defs>
          <filter id="encre" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/>
            <feDisplacementMap in="SourceGraphic" scale="2.4"/>
          </filter>
          <path id="arc" d="M 100,100 m -72,0 a 72,72 0 1,1 144,0 a 72,72 0 1,1 -144,0"/>
        </defs>
        <g filter="url(#encre)" fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="94" stroke-width="5"${pointille}/>
          <circle cx="100" cy="100" r="58" stroke-width="2"${pointille}/>
          <text fill="currentColor" stroke="none" font-family="Atkinson Hyperlegible, sans-serif" font-size="13" font-weight="700" letter-spacing="1.2">
            <textPath href="#arc" startOffset="50%" text-anchor="middle" textLength="440" lengthAdjust="spacing">${univ.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textPath>
          </text>
          <text x="100" y="100" fill="currentColor" stroke="none" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-size="${type === 'attente' ? 17 : 22}" font-weight="700">${textes[0]}</text>
          <text x="100" y="120" fill="currentColor" stroke="none" text-anchor="middle" font-family="Spectral, serif" font-style="italic" font-size="14">${textes[1]}</text>
        </g></svg>`,
    });
  }

  /** Aperçu fidèle du document ; le PDF signé reste la seule version qui fait foi. */
  function feuille({ type, annee, semestre, ref, statut, brouillon }) {
    const p = etat.profil;
    const releve = type === 'RELEVE_NOTES';
    const typeCachet = statut === 'SIGNED' ? 'signe' : statut === 'REVOKED' ? 'annule' : 'attente';
    const cleCachet = ref || '';
    const poser = typeCachet === 'signe' && !brouillon && !etat.cachetsPoses.has(cleCachet);
    if (poser) etat.cachetsPoses.add(cleCachet);

    return el('article', { class: 'feuille' + (statut === 'REVOKED' ? ' feuille-annulee' : ''), 'aria-label': 'Aperçu du document' },
      brouillon ? el('div', { class: 'feuille-brouillon', 'aria-hidden': 'true' }, 'Aperçu') : null,
      el('div', { class: 'feuille-entete' }, config.logoUrl
        // Comme sur le PDF : le logo porte les noms de l'université et de la faculté
        ? el('img', { class: 'feuille-logo', src: config.logoUrl, alt: config.faculty + ', ' + config.university })
        : [el('div', { class: 'feuille-univ' }, config.university), el('div', { class: 'feuille-fac' }, config.faculty)]),
      el('h3', { class: 'feuille-titre' }, TYPES[type].titre),
      el('div', { class: 'feuille-sous' }, 'Année universitaire ' + annee + (releve && semestre ? ', semestre ' + semestre.slice(1) : '')),
      releve
        ? el('p', {}, 'Relevé des notes obtenues par l\'étudiant(e) :')
        : el('p', {}, 'Le Doyen de la ' + config.faculty + ' atteste que l\'étudiant(e) :'),
      el('dl', {},
        el('dt', {}, 'Nom et prénom'), el('dd', {}, p.name),
        el('dt', {}, 'CNE'), el('dd', {}, p.cne)),
      releve
        ? el('div', { class: 'feuille-notes' }, 'Le détail des modules, des notes et la moyenne du semestre figurent dans le PDF signé.')
        : el('p', {}, 'est régulièrement inscrit(e) au titre de l\'année universitaire ' + annee + '.'),
      el('div', { class: 'feuille-pied' },
        el('div', { class: 'feuille-ref' }, ref ? ['Référence de vérification', el('strong', {}, ref)] : 'La référence de vérification sera attribuée à la signature.'),
        cachet(typeCachet, poser)));
  }

  // ================================================================ plan : consultation

  function afficherPlan() {
    const plan = $('#feuille');
    plan.replaceChildren();
    if (etat.mode === 'demande') { afficherDemande(plan); return; }

    const toutes = entrees();
    if (!toutes.length) {
      plan.append(el('div', { class: 'vide' },
        el('h3', {}, 'Votre première demande'),
        el('p', {}, 'Choisissez une attestation de scolarité ou un relevé de notes. Vous suivrez ici son traitement, puis vous téléchargerez le document signé.'),
        el('button', { type: 'button', class: 'bouton bouton-principal', onclick: ouvrirDemande }, 'Faire une demande')));
      return;
    }
    const e = toutes.find((x) => x.cle === etat.selection) || toutes[0];
    etat.selection = e.cle;

    const retour = el('button', { type: 'button', class: 'bouton retour', onclick: () => $('#atelier').classList.remove('consultation') }, 'Retour à mes documents');
    plan.append(retour, el('div', { class: 'plan-vue' },
      feuille({ type: e.type, annee: e.annee, semestre: e.semestre, ref: e.ref, statut: e.statut, brouillon: e.nature === 'demande' }),
      fiche(e)));
  }

  function fiche(e) {
    const info = ETATS[e.statut];
    const f = el('aside', { class: 'fiche', 'aria-label': 'Informations et actions' },
      el('div', {},
        el('h3', {}, TYPES[e.type].titre + (e.semestre ? ', semestre ' + e.semestre.slice(1) : '')),
        el('div', { class: 'fiche-etat etat etat-' + info.classe }, info.texte)));

    if (e.nature === 'document' && e.statut === 'SIGNED') {
      const doc = e.doc;
      f.append(
        el('p', {}, 'Signé électroniquement par la faculté le ' + dateLongue(doc.signedAt) + '. Toute modification du fichier invalide la signature.'),
        el('div', { class: 'fiche-actions' },
          el('button', { type: 'button', class: 'bouton bouton-principal', 'aria-keyshortcuts': 't', onclick: () => telecharger(doc) }, 'Télécharger le PDF signé'),
          el('button', { type: 'button', class: 'bouton', onclick: () => copierLien(doc) }, 'Copier le lien de vérification'),
          doc.verificationUrl ? el('a', { class: 'bouton', href: doc.verificationUrl, target: '_blank', rel: 'noopener' }, 'Voir la page de vérification') : null),
        el('p', {}, 'Transmettez le lien de vérification avec le document : l\'organisme destinataire contrôle lui-même son authenticité.'));
    } else if (e.statut === 'REVOKED') {
      f.append(el('div', { class: 'message' }, 'La faculté a annulé ce document le ' + dateLongue(e.doc.revokedAt)
        + (e.doc.revocationReason ? ' : ' + e.doc.revocationReason : '.')),
      el('p', {}, 'Il n\'a plus de valeur. Si vous en avez besoin, faites une nouvelle demande.'),
      el('button', { type: 'button', class: 'bouton', onclick: () => ouvrirDemande({ type: e.type, annee: e.annee, semestre: e.semestre }) }, 'Demander à nouveau'));
    } else if (e.statut === 'PENDING_APPROVAL') {
      f.append(el('p', {}, 'Le document est établi et attend une validation avant d\'être signé. Il apparaîtra comme prêt dès sa signature.'));
    } else {
      f.append(suivi(e.demande));
      if (e.statut === 'REJECTED' || e.statut === 'FAILED') {
        f.append(el('button', { type: 'button', class: 'bouton', onclick: () => ouvrirDemande({ type: e.type, annee: e.annee, semestre: e.semestre }) }, 'Corriger et redemander'));
      }
    }
    return f;
  }

  /** Les étapes d'une demande, dans l'ordre. */
  function suivi(d) {
    const etapes = [el('li', { class: 'fait' }, el('strong', {}, 'Demande envoyée'), el('span', {}, dateHeure(d.createdAt)))];
    if (d.status === 'PENDING') {
      etapes.push(el('li', { class: 'encours' }, el('strong', {}, 'Traitement par le service de scolarité'), el('span', {}, 'En cours')));
      etapes.push(el('li', {}, el('strong', {}, 'Signature et mise à disposition'), el('span', {}, 'À venir')));
    } else {
      const refus = d.status === 'REJECTED';
      etapes.push(el('li', { class: 'echec' },
        el('strong', {}, refus ? 'Demande refusée' : 'Production impossible'), el('span', {}, dateHeure(d.handledAt))));
    }
    const bloc = el('div', {}, el('ol', { class: 'suivi' }, etapes));
    if (d.message) bloc.append(el('div', { class: 'message' }, d.message));
    return bloc;
  }

  async function telecharger(doc) {
    try { await source.telecharger(doc); } catch (err) { toast(err.message, { erreur: true }); }
  }

  async function copierLien(doc) {
    try {
      await navigator.clipboard.writeText(doc.verificationUrl);
      toast('Lien de vérification copié.');
    } catch {
      toast('Copie impossible : sélectionnez le lien sur la page de vérification.', { erreur: true });
    }
  }

  // ================================================================ plan : nouvelle demande

  function ouvrirDemande(prerempli = {}) {
    etat.mode = 'demande';
    etat.prerempli = prerempli;
    $('#atelier').classList.add('consultation');
    afficherPlan();
    const premier = $('#feuille input:checked') || $('#feuille input');
    if (premier) premier.focus();
  }

  function fermerDemande() {
    etat.mode = 'vue';
    afficherPlan();
    if (!entrees().length) return;
    $('#atelier').classList.toggle('consultation', !matchMedia('(max-width: 760px)').matches);
  }

  function demandesDuJour(type) {
    const auj = new Date().toDateString();
    return etat.demandes.filter((d) => d.type === type && new Date(d.createdAt).toDateString() === auj).length;
  }

  function afficherDemande(plan) {
    const offres = etat.profil.documentTypes;
    if (!offres.length) {
      plan.append(el('div', { class: 'vide' }, el('h3', {}, 'Demande en ligne indisponible'),
        el('p', {}, 'La faculté ne propose pas de demande en ligne pour le moment. Adressez-vous au service de scolarité.'),
        el('button', { type: 'button', class: 'bouton', onclick: fermerDemande }, 'Revenir à mes documents')));
      return;
    }
    const pre = etat.prerempli || {};
    const typeInitial = offres.some((o) => o.type === pre.type) ? pre.type : offres[0].type;

    const form = el('form', { novalidate: true });
    const apercu = el('div', {});

    const choixType = el('fieldset', {}, el('legend', {}, 'Document'),
      el('div', { class: 'choix-type' }, offres.map((o) => {
        const reste = o.dailyLimit - demandesDuJour(o.type);
        return el('label', {},
          el('input', { type: 'radio', name: 'type', value: o.type, checked: o.type === typeInitial, disabled: reste <= 0 }),
          el('span', {}, el('strong', {}, TYPES[o.type].titre)),
          el('small', {}, reste <= 0 ? 'Limite de demandes atteinte pour aujourd\'hui.' : TYPES[o.type].aide));
      })));

    const annees = anneesProposees();
    const champAnnee = el('label', { class: 'champ' }, el('span', {}, 'Année universitaire'),
      el('select', { name: 'annee' }, annees.map((a) => el('option', { value: a, selected: a === (pre.annee || anneeCourante()) }, a))));

    const semestreChoisi = pre.semestre || 'S1';
    const champSemestre = el('fieldset', { class: 'champ-semestre' }, el('legend', {}, 'Semestre'),
      el('div', { class: 'semestres' }, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'].map((s) =>
        el('label', {}, el('input', { type: 'radio', name: 'semestre', value: s, checked: s === semestreChoisi, 'aria-label': 'Semestre ' + s.slice(1) }),
          el('span', { 'aria-hidden': 'true' }, s)))));

    const champUsage = el('label', { class: 'champ' }, el('span', {}, 'À quoi servira le document ?'),
      el('select', { name: 'usage' }, Object.entries(USAGES).map(([v, t]) => el('option', { value: v }, t))),
      el('p', { class: 'indication' }, 'Facultatif. Certains usages, comme un dossier pour l\'étranger, peuvent demander une validation supplémentaire.'));

    const delai = el('p', { class: 'message message-info' });
    const doublon = el('div', {});
    const erreur = el('p', { class: 'erreur-champ', role: 'alert', hidden: true });
    const envoyer = el('button', { type: 'submit', class: 'bouton bouton-principal' }, 'Envoyer la demande');

    form.append(
      el('div', {}, el('h3', {}, 'Nouvelle demande'),
        el('p', { class: 'indication' }, 'L\'aperçu à droite se met à jour au fil de vos choix.')),
      choixType, champAnnee, champSemestre, champUsage, delai, doublon, erreur,
      el('div', { class: 'composer-actions' }, envoyer,
        el('button', { type: 'button', class: 'bouton', onclick: fermerDemande }, 'Annuler')));

    const lire = () => {
      const fd = new FormData(form);
      const type = fd.get('type');
      return { type, annee: fd.get('annee'), semestre: type === 'RELEVE_NOTES' ? fd.get('semestre') : null, usage: fd.get('usage') || null };
    };

    const maj = () => {
      const v = lire();
      champSemestre.hidden = v.type !== 'RELEVE_NOTES';
      const offre = offres.find((o) => o.type === v.type);
      envoyer.disabled = !v.type;
      if (!offre) { delai.textContent = 'Toutes vos demandes du jour sont utilisées. Revenez demain.'; return; }
      const reste = offre.dailyLimit - demandesDuJour(v.type);
      // immediate : calculé par l'API pour l'année en cours (vue Apogée, ou inscription dans le registre)
      const immediat = (offre.immediate ?? offre.mode === 'AUTO') && (offre.mode !== 'REGISTRY' || v.annee === anneeCourante());
      delai.textContent = (immediat
        ? (offre.mode === 'REGISTRY' ? 'Le document est produit immédiatement à partir de votre inscription.'
          : 'Le document est produit immédiatement à partir de vos données Apogée.')
        : 'Votre demande est transmise au service de scolarité, qui établit le document.')
        + ` Il vous reste ${reste} demande${reste > 1 ? 's' : ''} aujourd'hui pour ce document.`;

      // Un document identique existe déjà : le proposer plutôt que d'en redemander un
      const existant = etat.documents.find((d) => d.type === v.type && d.academicYear === v.annee
        && (v.type !== 'RELEVE_NOTES' || d.semester === v.semestre) && d.status === 'SIGNED');
      const enCours = etat.demandes.find((d) => d.type === v.type && d.academicYear === v.annee
        && (v.type !== 'RELEVE_NOTES' || d.semester === v.semestre) && d.status === 'PENDING');
      doublon.replaceChildren();
      if (existant) {
        doublon.append(el('div', { class: 'message message-info' },
          'Vous avez déjà ce document, signé le ' + dateLongue(existant.signedAt) + '. ',
          el('button', { type: 'button', class: 'lien', onclick: () => selectionner('doc:' + existant.id) }, 'Ouvrir le document existant')));
      } else if (enCours) {
        doublon.append(el('div', { class: 'message message-info' }, 'Une demande identique est déjà en cours de traitement. ',
          el('button', { type: 'button', class: 'lien', onclick: () => selectionner('dem:' + enCours.id) }, 'Voir son avancement')));
      }
      apercu.replaceChildren(feuille({ type: v.type, annee: v.annee, semestre: v.semestre, statut: 'PENDING', brouillon: true }));
    };
    form.addEventListener('change', maj);

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = lire();
      erreur.hidden = true;
      if (!v.type) { erreur.textContent = 'Choisissez un document.'; erreur.hidden = false; return; }
      envoyerAvecDelai(v, envoyer);
    });

    plan.append(el('button', { type: 'button', class: 'bouton retour', onclick: fermerDemande }, 'Retour à mes documents'),
      el('div', { class: 'composer' }, form, apercu));
    maj();
  }

  /** Laisse quelques secondes pour annuler avant d'envoyer (une demande compte dans la limite du jour). */
  function envoyerAvecDelai(v, bouton) {
    bouton.disabled = true;
    let reste = DELAI_ENVOI;
    let annule = false;
    const compte = el('span', { class: 'toast-compte' });
    const t = toast('', { duree: 0, action: { texte: 'Annuler l\'envoi', faire: () => { annule = true; bouton.disabled = false; toast('Envoi annulé.'); } } });
    t.firstChild.replaceWith(el('span', {}, `${TYPES[v.type].titre} ${v.annee}${v.semestre ? ' ' + v.semestre : ''} : envoi dans `, compte, ' s'));
    compte.textContent = reste;
    const minuteur = setInterval(async () => {
      if (annule) { clearInterval(minuteur); return; }
      reste -= 1;
      compte.textContent = reste;
      if (reste > 0) return;
      clearInterval(minuteur);
      t.remove();
      try {
        const r = await source.envoyer({ type: v.type, academicYear: v.annee, semester: v.semestre, purpose: v.usage });
        await charger();
        if (r.status === 'FULFILLED' && r.documentId) {
          toast('Document prêt : il est signé et téléchargeable.');
          selectionner('doc:' + r.documentId);
        } else if (r.status === 'FAILED') {
          toast(r.message, { erreur: true, duree: 9000 });
          selectionner('dem:' + r.id);
        } else {
          toast('Demande envoyée au service de scolarité.');
          selectionner('dem:' + r.id);
        }
        afficherRegistre();
      } catch (err) {
        bouton.disabled = false;
        toast(err.message, { erreur: true, duree: 9000 });
      }
    }, 1000);
  }

  // ================================================================ clavier

  function deplacer(pas) {
    const lignes = [...document.querySelectorAll('.ligne')];
    if (!lignes.length) return;
    const i = lignes.findIndex((l) => l.dataset.cle === etat.selection);
    const suivante = lignes[Math.min(lignes.length - 1, Math.max(0, i + pas))];
    selectionner(suivante.dataset.cle);
    suivante.scrollIntoView({ block: 'nearest' });
  }

  function raccourcis(ev) {
    const saisie = ev.target.closest('input, select, textarea');
    if (ev.key === 'Escape' && etat.mode === 'demande') { fermerDemande(); return; }
    if (saisie || ev.ctrlKey || ev.metaKey || ev.altKey || $('#aide').open || $('#atelier').hidden) return;
    if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); ouvrirDemande(); }
    else if (ev.key === '/') { ev.preventDefault(); $('#recherche').focus(); }
    else if (ev.key === '?') { ev.preventDefault(); $('#aide').showModal(); }
    else if ((ev.key === 't' || ev.key === 'T') && etat.mode === 'vue') {
      const e = entrees().find((x) => x.cle === etat.selection);
      if (e && e.statut === 'SIGNED') { ev.preventDefault(); telecharger(e.doc); }
    } else if (ev.target.id === 'liste' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault(); deplacer(ev.key === 'ArrowDown' ? 1 : -1);
    }
  }

  // ================================================================ démarrage

  async function demarrer() {
    const params = new URLSearchParams(location.search);
    etat.demo = params.has('demo') || location.protocol === 'file:';
    if (!etat.demo) {
      try {
        config = await (await fetch('/etudiant/config.json')).json();
        oidc = await (await fetch(config.issuer + '/.well-known/openid-configuration')).json();
      } catch {
        bandeau('Le service est momentanément injoignable.', () => location.reload());
        return;
      }
    } else {
      config = demo.config;
    }
    $('#univ').textContent = config.faculty;
    $('#fac').textContent = config.university;
    if (config.logoUrl) {
      const logo = $('#logo');
      logo.src = config.logoUrl;
      logo.alt = config.shortName || '';
      logo.hidden = false;
    }
    document.title = 'Mes documents officiels, ' + (config.shortName || config.faculty);

    $('#connexion').addEventListener('click', seConnecter);
    $('#deconnexion').addEventListener('click', seDeconnecter);
    $('#aide-btn').addEventListener('click', () => $('#aide').showModal());

    if (!etat.demo) {
      jeton = JSON.parse(store.getItem('jeton') || 'null');
      await retourConnexion();
      if (!jeton) {
        if (params.has('sso')) { await seConnecter(); return; }
        $('#accueil').hidden = false;
        return;
      }
    }

    $('#atelier').hidden = false;
    etat.profil = await source.profil();
    $('#etudiant-nom').textContent = etat.profil.name;
    $('#etudiant-cne').textContent = etat.profil.cne;
    $('#identite').hidden = false;

    $('#nouvelle').addEventListener('click', () => ouvrirDemande());
    $('#recherche').addEventListener('input', (ev) => { etat.recherche = ev.target.value; afficherRegistre(); });
    document.querySelectorAll('.filtre').forEach((f) => f.addEventListener('click', () => {
      etat.filtre = f.dataset.filtre;
      document.querySelectorAll('.filtre').forEach((g) => g.setAttribute('aria-checked', String(g === f)));
      afficherRegistre();
    }));
    document.addEventListener('keydown', raccourcis);

    await charger();
    // À l'ouverture : le document prêt le plus récent, sinon l'élément le plus récent
    const toutes = entrees();
    const premiere = toutes.find((e) => e.statut === 'SIGNED') || toutes[0];
    etat.selection = premiere ? premiere.cle : null;
    if (!matchMedia('(max-width: 760px)').matches) $('#atelier').classList.add('consultation');
    afficherRegistre();
    afficherPlan();
    if (etat.demo) toast('Mode démonstration : données d\'exemple, rien n\'est envoyé.', { duree: 6000 });
  }

  // ================================================================ données de démonstration

  const ilYa = (jours, heures = 0) => new Date(Date.now() - (jours * 24 + heures) * 3600e3).toISOString();
  const demo = {
    config: { university: 'Université Hassan II de Casablanca', faculty: 'Faculté des Sciences Ben M\'Sick',
      shortName: 'FSBM', city: 'Casablanca', logoUrl: '../branding/logo.png', clientId: 'demo', issuer: '' },
    profil: { cne: 'R130456789', username: 'etudiant', name: 'Yasmine El Amrani',
      documentTypes: [
        { type: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', mode: 'AUTO', dailyLimit: 3 },
        { type: 'RELEVE_NOTES', label: 'Relevé de notes', mode: 'AGENT', dailyLimit: 3 },
      ] },
    documents: [
      { id: 'd1', type: 'RELEVE_NOTES', label: 'Relevé de notes', status: 'SIGNED', academicYear: '2025-2026', semester: 'S5',
        createdAt: ilYa(2), signedAt: ilYa(2), verificationCode: 'PYZVH-Z3830-X9B28-CQ19P',
        verificationUrl: 'https://esign.fsbm.ma/verify/PYZVH-Z3830-X9B28-CQ19P', downloadUrl: '#' },
      { id: 'd2', type: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', status: 'SIGNED', academicYear: '2025-2026',
        semester: null, createdAt: ilYa(21), signedAt: ilYa(21), verificationCode: 'KFFH8-SSNTP-3GYNG-XC28A',
        verificationUrl: 'https://esign.fsbm.ma/verify/KFFH8-SSNTP-3GYNG-XC28A', downloadUrl: '#' },
      { id: 'd3', type: 'RELEVE_NOTES', label: 'Relevé de notes', status: 'REVOKED', academicYear: '2024-2025', semester: 'S4',
        createdAt: ilYa(160), signedAt: ilYa(160), verificationCode: 'M2Q7D-8TRWA-4KXNB-J61PZ', revokedAt: ilYa(150),
        revocationReason: 'note du module M42 corrigée après réclamation, un nouveau relevé a été établi' },
      { id: 'd4', type: 'RELEVE_NOTES', label: 'Relevé de notes', status: 'SIGNED', academicYear: '2024-2025', semester: 'S4',
        createdAt: ilYa(149), signedAt: ilYa(149), verificationCode: 'C7HN2-QW4ZE-9MBXT-5RD8K',
        verificationUrl: 'https://esign.fsbm.ma/verify/C7HN2-QW4ZE-9MBXT-5RD8K', downloadUrl: '#' },
    ],
    demandes: [
      { id: 'r1', type: 'RELEVE_NOTES', label: 'Relevé de notes', academicYear: '2025-2026', semester: 'S6', status: 'PENDING',
        message: null, documentId: null, createdAt: ilYa(0, 3), handledAt: null },
      { id: 'r2', type: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', academicYear: '2026-2027', semester: null,
        status: 'REJECTED', message: 'Votre réinscription 2026-2027 n\'est pas encore finalisée : réglez les frais puis renouvelez la demande.',
        documentId: null, createdAt: ilYa(1), handledAt: ilYa(0, 20) },
    ],
  };

  demarrer().catch((err) => bandeau(err.message || 'Une erreur est survenue.', () => location.reload()));
})();
