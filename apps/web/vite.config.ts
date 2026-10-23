import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin in development: the browser only ever talks to Vite, which forwards /api.
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: false },
    },
  },
});
