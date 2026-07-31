import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../backend/public')

// Build React into Laravel public/ so one server (php artisan serve / cPanel) serves both UI + API
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'clean-laravel-spa-assets',
      apply: 'build',
      buildStart() {
        rmSync(path.join(publicDir, 'assets'), { recursive: true, force: true })
        rmSync(path.join(publicDir, 'index.html'), { force: true })
      },
    },
  ],
  base: '/',
  build: {
    outDir: publicDir,
    emptyOutDir: false,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
