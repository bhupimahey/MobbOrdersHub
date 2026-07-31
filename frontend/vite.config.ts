import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const laravelPublicDir = path.resolve(__dirname, '../backend/public')
const pagesOutDir = process.env.VITE_OUT_DIR
  ? path.resolve(__dirname, process.env.VITE_OUT_DIR)
  : null
const outDir = pagesOutDir ?? laravelPublicDir

// Build React into Laravel public/ so one server (php artisan serve / cPanel) serves both UI + API
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'clean-laravel-spa-assets',
      apply: 'build',
      buildStart() {
        if (pagesOutDir) return
        rmSync(path.join(laravelPublicDir, 'assets'), { recursive: true, force: true })
        rmSync(path.join(laravelPublicDir, 'index.html'), { force: true })
      },
    },
  ],
  base: process.env.VITE_BASE || '/',
  build: {
    outDir,
    emptyOutDir: Boolean(pagesOutDir),
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
