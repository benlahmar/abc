import { COMPTES, URL, anneeCourante, api, backoffice, demander, ouvrirDemandeEtudiant, parametrageParDefaut, viderFileEtudiant, expect, test } from './plateforme';

test.beforeEach(async ({ request }) => {
  await parametrageParDefaut(await api(request, COMPTES.admin));
  await viderFileEtudiant(await api(request, COMPTES.agent));
});

test('l\'étudiant demande une attestation, l\'agent l\'établit, l\'étudiant la télécharge et elle se vérifie', async ({ ouvrir }) => {
  // 1. L'étudiant, arrivé par l'ancienne adresse (lien de l'ENT), demande une attestation
  const etudiant = await ouvrir();
  await etudiant.goto(`${URL.api}/demandes/?sso=1`);
  await expect(etudiant).toHaveURL(/realms\/universite/);
  await etudiant.locator('#username').fill(COMPTES.etudiant.login);
  await etudiant.locator('#password').fill(COMPTES.etudiant.mdp);
  await etudiant.locator('#kc-login').click();
  await expect(etudiant).toHaveURL(new RegExp(`^${URL.etudiant}`));
  await demander(etudiant, { type: 'Attestation de scolarité' });
  await expect(etudiant.getByText('Demande envoyée au service de scolarité.')).toBeVisible({ timeout: 15_000 });
  await expect(etudiant.getByRole('complementary', { name: 'Informations et actions' })).toContainText('Traitement par le service de scolarité');

  // 2. L'agent la trouve dans sa file et établit le document
  const agent = await ouvrir();
  await backoffice(agent, COMPTES.agent);
  await ouvrirDemandeEtudiant(agent, 'Attestation de scolarité');
  await agent.getByRole('button', { name: /Saisir les données/ }).click();
  await agent.getByLabel('Filière').fill('Sciences Mathématiques et Informatique');
  await agent.getByLabel('Niveau').fill('Licence 3');
  await agent.getByRole('button', { name: 'Établir et signer' }).click();
  await expect(agent.getByText(/Attestation de scolarité établi et signé pour Yasmine El Amrani/)).toBeVisible();

  // 3. L'étudiant le voit prêt et télécharge le PDF signé
  await etudiant.reload();
  await expect(etudiant.getByText(`CNE ${COMPTES.etudiant.cne}`)).toBeVisible();
  await etudiant.getByRole('radio', { name: /Prêts/ }).click();
  await etudiant.getByRole('option').filter({ hasText: 'Attestation de scolarité' }).first().click();
  const fiche = etudiant.getByRole('complementary', { name: 'Informations et actions' });
  await expect(fiche).toContainText('Prêt');
  const [telechargement] = await Promise.all([etudiant.waitForEvent('download'), fiche.getByRole('button', { name: 'Télécharger le PDF signé' }).click()]);
  const pdf = await telechargement.createReadStream();
  const debut = await new Promise<string>((ok) => pdf.once('data', (b) => ok(b.toString('latin1', 0, 5))));
  expect(debut).toBe('%PDF-');
  expect(telechargement.suggestedFilename()).toBe(`attestation_scolarite-${anneeCourante()}.pdf`);

  // 4. L'organisme destinataire vérifie le document en ligne
  const lien = await fiche.getByRole('link', { name: 'Voir la page de vérification' }).getAttribute('href');
  const verification = await ouvrir();
  await verification.goto(lien!);
  await expect(verification.getByText('Document authentique délivré par l\'établissement.')).toBeVisible();
});
