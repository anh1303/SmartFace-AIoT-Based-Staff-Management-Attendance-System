import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    cacheDir: '.vite-cache',
    plugins: [react({ exclude: [/\/node_modules\//, /\/\.vite-cache\//] }), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'vendor-query';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-core';
              }
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/socket.io': {
          target: 'http://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
        },
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
      // Allow resource-limited environments to disable HMR and file watching together.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
