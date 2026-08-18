import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Keep AI chat SSE open longer than the default proxy timeout
        timeout: 0,
        proxyTimeout: 0,
        configure: (proxy) => {
          // If the API ever returns an absolute redirect to :8080, keep it on the Vite origin.
          proxy.on('proxyRes', (proxyRes) => {
            const location = proxyRes.headers['location'];
            if (typeof location === 'string' && /:\/\/localhost:8080\b/i.test(location)) {
              proxyRes.headers['location'] = location.replace(
                /^https?:\/\/localhost:8080/i,
                '',
              );
            }
          });
        },
      },
    },
  },
});
