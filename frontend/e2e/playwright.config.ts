import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout contre une plateforme démarrée (docker compose up, ou API + Keycloak + applications
 * en local). À lancer sur un environnement de TEST : les scénarios modifient le paramétrage (puis le
 * rétablissent), créent des documents et ajoutent l'étudiant de démonstration au registre des inscrits.
 */
export default defineConfig({
  testDir: '.',
  // Les scénarios partagent le paramétrage de la plateforme : un à la fois, dans l'ordre des fichiers
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'rapport', open: 'never' }]],
  outputDir: 'resultats',
  use: {
    ...devices['Desktop Chrome'],
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
