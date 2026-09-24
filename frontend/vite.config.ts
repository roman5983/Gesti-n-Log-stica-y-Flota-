import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Dev server on 5173. The API is reached same-origin through /api (see
 * src/api/axios.ts): Vite forwards it to the backend on 3000, mirroring the
 * Vercel rewrite used in production (vercel.json). Dev and production thus
 * share the same topology — cookies, CORS and relative URLs behave the same.
 */
export default defineConfig({
  plugins: [react()],
  // `@/…` = `src/…`: imports stay valid when a component folder moves, and
  // read the same from anywhere in the tree (see docs, frontend structure).
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
