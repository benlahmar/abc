import { COMPTES, api, backoffice, demander, espaceEtudiant, ouvrirDemandeEtudiant, parametrageParDefaut, viderFileEtudiant, expect, test } from './plateforme';

test.beforeEach(async ({ request }) => {
  const admin = await api(request, COMPTES.admin);
  await parametrageParDefaut(admin);
  await viderFileEtudiant(await api(request, COMPTES.agent));
  // Circuit : le vice-doyen valide les relevés destinés à l'étranger
  await admin.put('/api/v1/admin/workflows/RELEVE_NOTES', { steps: [
    { name: 'Validation du vice-doyen à la pédagogie', role: 'VICE_DOYEN_PEDAGOGIE', condition: 'IF_PURPOSE', purposes: ['ETRANGER'] },
  ] });
});

test.afterEach(async ({ request }) => parametrageParDefaut(await api(request, COMPTES.admin)));

test('un relevé pour l\'étranger passe par le vice-doyen avant d\'être signé', async ({ ouvrir }) => {
  const etudiant = await ouvrir();
  await espaceEtudiant(etudiant);
  await demander(etudiant, { type: 'Relevé de notes', semestre: 'S5', usage: 'Dossier pour l\'étranger' });
  await expect(etudiant.getByText('Demande envoyée au service de scolarité.')).toBeVisible({ timeout: 15_000 });

  // L'agent établit le relevé : le circuit le retient pour validation
  const agent = await ouvrir();
  await backoffice(agent, COMPTES.agent);
  await ouvrirDemandeEtudiant(agent, 'Relevé de notes');
  await agent.getByRole('button', { name: /Saisir les données/ }).click();
  await agent.getByLabel('Filière').fill('Sciences Mathématiques et Informatique');
  await agent.getByLabel('Niveau').fill('Licence 3');
  await agent.getByLabel('Code du module 1').fill('M51');
  await agent.getByLabel('Intitulé du module 1').fill('Réseaux informatiques');
  await agent.getByLabel('Note du module 1').fill('14,5');
  await agent.getByLabel('Crédits du module 1').fill('6');
  await agent.getByRole('button', { name: 'Établir et signer' }).click();
  await expect(agent.getByText(/Relevé de notes établi, en attente de validation pour Yasmine El Amrani/)).toBeVisible();

  await etudiant.reload();
  await expect(etudiant.getByRole('option').filter({ hasText: 'Relevé de notes' }).filter({ hasText: 'En validation' }).first()).toBeVisible();

  // Le vice-doyen examine et approuve : c'est la dernière étape, le document est signé
  const viceDoyen = await ouvrir();
  await backoffice(viceDoyen, COMPTES.viceDoyen);
  await expect(viceDoyen.getByRole('heading', { name: 'Approbations' })).toBeVisible();
  await viceDoyen.getByRole('row').filter({ hasText: COMPTES.etudiant.cne }).first().click();
  await viceDoyen.getByLabel('Commentaire (facultatif)').fill('Notes conformes au PV de délibération');
  await viceDoyen.getByRole('button', { name: /Approuver et signer/ }).click();
  // Le nom est enregistré sous sa forme administrative (« EL AMRANI Yasmine »)
  await expect(viceDoyen.getByText(/Approuvé : le document de .*Yasmine.* est signé/i)).toBeVisible();

  await etudiant.reload();
  await etudiant.getByRole('radio', { name: /En cours/ }).click();
  await expect(etudiant.getByRole('option').filter({ hasText: 'Relevé de notes' }).filter({ hasText: 'En validation' })).toHaveCount(0);
});
