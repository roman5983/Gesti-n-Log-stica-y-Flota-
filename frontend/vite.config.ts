import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server on 5173. The API is reached same-origin through /api (see
 * src/api/axios.ts): Vite forwards it to the backend on 3000, mirroring the
 * Vercel rewrite used in production (vercel.json). Dev and production thus
 * share the same topology — cookies, CORS and relative URLs behave the same.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
