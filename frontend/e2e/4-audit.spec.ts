import { expect, test } from '@playwright/test';
import { COMPTES, backoffice } from './plateforme';

test('l\'administrateur vérifie l\'intégrité du journal et retrouve l\'historique de l\'étudiant', async ({ page }) => {
  await backoffice(page, COMPTES.admin, '/audit');
  await page.getByRole('button', { name: 'Vérifier l\'intégrité' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Journal intègre' })).toBeVisible();
  await expect(page.getByText(/Empreinte de tête/)).toBeVisible();

  await page.getByPlaceholder('CNE, nom, référence, motif…').fill(COMPTES.etudiant.cne);
  const lignes = page.locator('.journal-tableau tbody tr');
  await expect(lignes.filter({ hasText: 'Signé (cachet électronique)' }).first()).toBeVisible();
  await lignes.first().click();
  await expect(page.getByRole('heading', { name: 'Scellement' })).toBeVisible();

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter (CSV)' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^journal-audit.*\.csv$/);
});

test('les agents n\'ont pas accès au journal ni au paramétrage', async ({ page }) => {
  await backoffice(page, COMPTES.agent);
  const navigation = page.getByRole('navigation', { name: 'Sections' });
  await expect(navigation.getByRole('link', { name: 'Journal d\'audit' })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Paramétrage' })).toHaveCount(0);
});
