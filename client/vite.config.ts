import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true, // the API's CORS policy and reset links expect exactly this origin
      proxy: {
        // The browser only ever talks to localhost:5173. Vite forwards /api to the ASP.NET Core API,
        // so the refresh-token cookie is same-origin and SameSite=Strict works in development.
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:5080',
          changeOrigin: false,
        },
      },
    },
  }
})
