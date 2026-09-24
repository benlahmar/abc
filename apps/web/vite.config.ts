import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En développement, l'API Node tourne sur :4000.
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Bibliothèques stables dans des fichiers séparés : mieux mis en cache entre deux déploiements.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'react';
          if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          return undefined;
        },
      },
    },
  },
});
