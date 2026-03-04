import { defineConfig } from 'vite';

export default defineConfig({
  // Path-agnostic deploy behind Cloudflare Tunnel prefixes (/resize, etc.)
  base: './',
  server: {
    host: true,
    port: 3340,
    strictPort: true,
  },
});
