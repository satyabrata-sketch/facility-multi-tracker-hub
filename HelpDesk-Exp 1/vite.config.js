import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'ag-grid': ['ag-grid-community', 'ag-grid-react'],
          'recharts-vendor': ['recharts'],
          'xlsx-style-vendor': ['xlsx-js-style'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
});
