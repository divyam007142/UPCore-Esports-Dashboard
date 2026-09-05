import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Cloudflare Pages serves this app from the domain root. Absolute build
  // paths keep assets working even if a nested URL such as /auth/me is opened.
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 8080),
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://upcore-api-proxy.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
