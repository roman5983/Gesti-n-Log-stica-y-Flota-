import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server on 5173 (matches the backend CORS_ORIGIN). API calls go to
// the backend on 3000 through the VITE_API_URL env var (see src/api/axios.ts).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
