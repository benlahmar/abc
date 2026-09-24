import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:4000', '/uploads': 'http://localhost:4000', '/images': 'http://localhost:4000' },
  },
  build: { target: 'es2022' },
});
