import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'https://localhost:8443';
  const githubReleaseTag =
    env.GITHUB_RELEASE_TAG ||
    env.RELEASE_TAG ||
    env.GITHUB_REF_NAME ||
    packageJson.version ||
    '0.0.0';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GITHUB_RELEASE': JSON.stringify(githubReleaseTag),
    },
    build: {
      // Keep warnings useful while acknowledging this is an admin-style SPA.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }

            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }

            if (id.includes('axios')) {
              return 'vendor-network';
            }

            return 'vendor';
          },
        },
      },
    },
    server: {
      proxy: {
        '/auth': { target: proxyTarget, changeOrigin: true, secure: false },
        '/system': { target: proxyTarget, changeOrigin: true, secure: false },
        '/logs': { target: proxyTarget, changeOrigin: true, secure: false, ws: true },
        '/metrics': { target: proxyTarget, changeOrigin: true, secure: false, ws: true },
        '/api': { target: proxyTarget, changeOrigin: true, secure: false, ws: true },
      },
    },
  };
});
