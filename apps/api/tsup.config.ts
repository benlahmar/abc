import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Le paquet partagé est en TypeScript source : on l'embarque dans le bundle.
  noExternal: ['@fsbm/shared'],
});
