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
    build: {
      rolldownOptions: {
        output: {
          // Long-lived libraries go into their own chunks, so a new deploy only invalidates the small app
          // chunks and returning visitors keep the libraries cached. Charts (recharts) are already split off
          // by the lazy dashboard routes.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
              { name: 'router', test: /node_modules[\\/]react-router[\\/]/, priority: 20 },
              { name: 'forms', test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/, priority: 20 },
              { name: 'data', test: /node_modules[\\/](axios|@tanstack)[\\/]/, priority: 20 },
            ],
          },
        },
      },
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
