import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_UI_PORT = 8443

function getUiPort(env: Record<string, string>): number {
  const rawPort = (process.env.DAYSHIELD_UI_PORT ?? process.env.UI_PORT ?? env.DAYSHIELD_UI_PORT ?? env.UI_PORT ?? env.VITE_UI_PORT ?? String(DEFAULT_UI_PORT)).trim()
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid UI port value '${rawPort}'. Set DAYSHIELD_UI_PORT, UI_PORT, or VITE_UI_PORT to a valid port number between 1 and 65535.`,
    )
  }

  return port
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const uiPort = getUiPort(env)

  return {
    plugins: [react()],
    server: {
      port: uiPort,
      proxy: {
        '/api/metrics/ws': {
          target: 'ws://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/logs/ws': {
          target: 'ws://127.0.0.1:3000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: uiPort,
    },
  }
})
