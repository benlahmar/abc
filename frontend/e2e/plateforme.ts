import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

/**
 * test, avec « ouvrir » : une nouvelle fenêtre isolée (sa propre session) par personne du scénario —
 * étudiant, agent, validateur… Toutes sont fermées à la fin du test.
 */
export const test = base.extend<{ ouvrir: () => Promise<Page> }>({
  ouvrir: async ({ browser }, use) => {
    const contextes: BrowserContext[] = [];
    await use(async () => {
      const c = await browser.newContext();
      contextes.push(c);
      return c.newPage();
    });
    await Promise.all(contextes.map((c) => c.close()));
  },
});
export { expect };

/** Adresses de la plateforme testée (par défaut : docker compose sur ce poste). */
export const URL = {
  api: process.env.E2E_API ?? 'http://localhost:8080',
  backoffice: process.env.E2E_BACKOFFICE ?? 'http://localhost:8081',
  etudiant: process.env.E2E_ETUDIANT ?? 'http://localhost:8082',
  keycloak: process.env.E2E_ISSUER ?? 'http://localhost:8180/realms/universite',
};

/** Comptes de démonstration créés par docker/keycloak/init-realm.sh. */
export const COMPTES = {
  etudiant: { login: 'etudiant', mdp: 'etudiant123', nom: 'Yasmine El Amrani', cne: 'R130456789' },
  agent: { login: 'agent.apogee', mdp: 'agent123' },
  viceDoyen: { login: 'vice.doyen', mdp: 'vicedoyen123' },
  doyen: { login: 'doyen', mdp: 'doyen123' },
  admin: { login: 'admin.esign', mdp: 'admin123' },
} as const;

type Compte = { login: string; mdp: string };

/** Année universitaire en cours (elle commence en septembre). */
export function anneeCourante(d = new Date()) {
  const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${a}-${a + 1}`;
}

/** Saisie du formulaire de connexion Keycloak (page déjà redirigée vers le SSO). */
async function seConnecterSurKeycloak(page: Page, compte: Compte) {
  await page.locator('#username').fill(compte.login);
  await page.locator('#password').fill(compte.mdp);
  await page.locator('#kc-login').click();
}

/** Ouvre le back-office avec ce compte. */
export async function backoffice(page: Page, compte: Compte, chemin = '/') {
  await page.goto(URL.backoffice + chemin);
  await page.getByRole('button', { name: 'Se connecter avec mon compte FSBM' }).click();
  await seConnecterSurKeycloak(page, compte);
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
}

/** Ouvre l'espace étudiant en connexion directe, comme depuis un lien de l'ENT. */
export async function espaceEtudiant(page: Page) {
  await page.goto(`${URL.etudiant}/?sso=1`);
  await seConnecterSurKeycloak(page, COMPTES.etudiant);
  await expect(page.getByText(`CNE ${COMPTES.etudiant.cne}`)).toBeVisible();
}

/**
 * Appels directs à l'API pour préparer et remettre en état la plateforme (paramétrage), avec le jeton d'un
 * compte de démonstration (client esign-etudiant, qui accepte l'authentification par mot de passe).
 */
export async function api(request: APIRequestContext, compte: Compte) {
  const r = await request.post(`${URL.keycloak}/protocol/openid-connect/token`, {
    form: { grant_type: 'password', client_id: 'esign-etudiant', username: compte.login, password: compte.mdp, scope: 'openid' },
  });
  expect(r.ok(), `jeton de ${compte.login}`).toBeTruthy();
  const { access_token: jeton } = await r.json();
  const appel = async (methode: 'GET' | 'PUT' | 'POST', chemin: string, data?: unknown) => {
    const res = await request.fetch(URL.api + chemin, { method: methode, data, headers: { Authorization: `Bearer ${jeton}` } });
    expect(res.ok(), `${methode} ${chemin} : ${res.status()} ${await res.text()}`).toBeTruthy();
    return res.status() === 204 ? null : res.json();
  };
  return {
    get: (chemin: string) => appel('GET', chemin),
    put: (chemin: string, data: unknown) => appel('PUT', chemin, data),
    post: (chemin: string, data?: unknown) => appel('POST', chemin, data),
  };
}

export type Api = Awaited<ReturnType<typeof api>>;

/** Paramétrage par défaut de la plateforme, rétabli après chaque scénario qui le modifie. */
export async function parametrageParDefaut(admin: Api) {
  await admin.put('/api/v1/admin/workflows/RELEVE_NOTES', { steps: [] });
  await admin.put('/api/v1/admin/workflows/ATTESTATION_SCOLARITE', { steps: [] });
  // Limite large : les scénarios rejouables plusieurs fois par jour ne doivent pas l'atteindre
  await admin.put('/api/v1/admin/student-access/ATTESTATION_SCOLARITE', { mode: 'AGENT', dailyLimit: 50 });
  await admin.put('/api/v1/admin/student-access/RELEVE_NOTES', { mode: 'AGENT', dailyLimit: 50 });
}

/** Demande faite par l'étudiant depuis son espace (avec les 5 secondes d'annulation). */
export async function demander(page: Page, choix: { type: 'Attestation de scolarité' | 'Relevé de notes'; annee?: string; semestre?: string; usage?: string }) {
  await page.getByRole('button', { name: 'Nouvelle demande' }).click();
  await page.getByRole('radio', { name: choix.type }).check();
  if (choix.annee) await page.getByLabel('Année universitaire').selectOption(choix.annee);
  if (choix.semestre) await page.getByRole('radio', { name: `Semestre ${choix.semestre.slice(1)}` }).check({ force: true });
  if (choix.usage) await page.getByLabel('À quoi servira le document ?').selectOption({ label: choix.usage });
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText(/envoi dans/)).toBeVisible();
}

/** Demandes de l'étudiant de démonstration encore en attente (essais précédents) : refusées, pour repartir à zéro. */
export async function viderFileEtudiant(agent: Api) {
  const enAttente = (await agent.get('/api/v1/student-requests?status=PENDING')) as { id: string; studentCne: string }[];
  for (const r of enAttente.filter((x) => x.studentCne === COMPTES.etudiant.cne)) {
    await agent.post(`/api/v1/student-requests/${r.id}/reject`, { reason: 'Nettoyage avant les tests automatiques' });
  }
}

/** L'agent ouvre la demande de l'étudiant de démonstration dans la file « Demandes étudiantes ». */
export async function ouvrirDemandeEtudiant(page: Page, document: string) {
  await page.getByRole('link', { name: /Demandes étudiantes/ }).click();
  const ligne = page.getByRole('row').filter({ hasText: COMPTES.etudiant.cne }).filter({ hasText: document });
  await expect(ligne).toHaveCount(1);
  await ligne.click();
  return ligne;
}

/** Débloque l'étudiant de démonstration dans le registre de l'année (un essai interrompu a pu le laisser bloqué). */
export async function debloquerEtudiant(agent: Api) {
  const page = (await agent.get(`/api/v1/registry/students?academicYear=${anneeCourante()}&q=${COMPTES.etudiant.cne}`)) as {
    items: { id: number; cne: string; blocked: boolean }[];
  };
  for (const s of page.items.filter((x) => x.cne === COMPTES.etudiant.cne && x.blocked)) {
    await agent.post(`/api/v1/registry/students/${s.id}/unblock`);
  }
}
