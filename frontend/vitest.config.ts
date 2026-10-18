import { defineConfig } from 'vitest/config';

// Tests unitaires seulement : les scénarios de bout en bout (e2e/) se lancent avec « npm run e2e »
export default defineConfig({
  test: { include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'] },
});
