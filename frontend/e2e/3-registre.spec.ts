import { COMPTES, api, debloquerEtudiant, backoffice, demander, espaceEtudiant, parametrageParDefaut, viderFileEtudiant, expect, test } from './plateforme';

/** Filière réservée aux tests : les vraies listes ne sont pas remplacées. */
const FILIERE = 'Filière des tests automatiques';
const LISTE = `CNE;Nom;Prénom;Date de naissance;Lieu de naissance;Filière;Niveau
${COMPTES.etudiant.cne};El Amrani;Yasmine;14/05/2003;Fès;${FILIERE};Licence 3
R199999901;Témoin;Inscrit;01/01/2004;Casablanca;${FILIERE};Licence 1
`;

test.beforeEach(async ({ request }) => {
  const admin = await api(request, COMPTES.admin);
  await parametrageParDefaut(admin);
  const agent = await api(request, COMPTES.agent);
  await viderFileEtudiant(agent);
  await debloquerEtudiant(agent);
  await admin.put('/api/v1/admin/student-access/ATTESTATION_SCOLARITE', { mode: 'REGISTRY', dailyLimit: 50 });
});

test.afterEach(async ({ request }) => {
  await parametrageParDefaut(await api(request, COMPTES.admin));
  const agent = await api(request, COMPTES.agent);
  await viderFileEtudiant(agent);
  await debloquerEtudiant(agent);
});

test('inscrit au registre : attestation immédiate ; bloqué : la demande va au service', async ({ ouvrir }) => {
  // L'agent importe la liste de la filière, après vérification
  const agent = await ouvrir();
  await backoffice(agent, COMPTES.agent, '/registre');
  await agent.getByRole('button', { name: /Importer une liste/ }).first().click();
  await agent.locator('.depot input[type=file]').setInputFiles({ name: 'inscrits-tests.csv', mimeType: 'text/csv', buffer: Buffer.from(LISTE, 'utf8') });
  await agent.getByRole('button', { name: 'Vérifier la liste' }).click();
  await expect(agent.getByRole('region', { name: 'Résultat de la vérification' })).toContainText(FILIERE);
  await agent.getByRole('button', { name: 'Remplacer la liste' }).click();
  await agent.getByRole('dialog').getByRole('button', { name: 'Remplacer' }).click();
  await expect(agent.getByText(/Registre .* mis à jour/)).toBeVisible();

  // Inscrite : l'attestation est signée aussitôt
  const etudiant = await ouvrir();
  await espaceEtudiant(etudiant);
  await etudiant.getByRole('button', { name: 'Nouvelle demande' }).click();
  await expect(etudiant.getByText('Le document est produit immédiatement à partir de votre inscription.', { exact: false })).toBeVisible();
  await etudiant.getByRole('button', { name: 'Annuler', exact: true }).click();
  await demander(etudiant, { type: 'Attestation de scolarité' });
  await expect(etudiant.getByText('Document prêt : il est signé et téléchargeable.')).toBeVisible({ timeout: 15_000 });
  await expect(etudiant.getByRole('button', { name: 'Télécharger le PDF signé' })).toBeVisible();

  // Bloquée par l'agent : la demande suivante va au service, avec une note pour les agents
  await agent.getByPlaceholder('CNE ou nom').fill(COMPTES.etudiant.cne);
  await agent.locator('.inscrits li').filter({ hasText: COMPTES.etudiant.cne }).getByRole('button', { name: 'Bloquer…' }).click();
  await agent.getByRole('dialog').getByRole('button', { name: 'Transfert en cours' }).click();
  await agent.getByRole('dialog').getByRole('button', { name: 'Bloquer', exact: true }).click();
  await expect(agent.locator('.inscrits li').filter({ hasText: COMPTES.etudiant.cne })).toContainText('Bloqué');

  await demander(etudiant, { type: 'Attestation de scolarité' });
  await expect(etudiant.getByText('Demande envoyée au service de scolarité.')).toBeVisible({ timeout: 15_000 });

  await agent.getByRole('link', { name: /Demandes étudiantes/ }).click();
  const ligne = agent.getByRole('row').filter({ hasText: COMPTES.etudiant.cne });
  await expect(ligne).toContainText('À vérifier');
  await ligne.click();
  await expect(agent.getByText(/Bloqué dans le registre par .* : Transfert en cours/)).toBeVisible();

  // Remise en état : débloquée
  await agent.getByRole('link', { name: /Registre des inscrits/ }).click();
  await agent.getByRole('row').filter({ hasText: FILIERE }).click();
  await agent.getByPlaceholder('CNE ou nom').fill(COMPTES.etudiant.cne);
  await agent.locator('.inscrits li').filter({ hasText: COMPTES.etudiant.cne }).getByRole('button', { name: 'Débloquer' }).click();
  await expect(agent.locator('.inscrits li').filter({ hasText: COMPTES.etudiant.cne })).not.toContainText('Bloqué');
});
