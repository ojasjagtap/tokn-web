import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Plugin to copy landing folder to dist
const copyLandingPlugin = () => ({
  name: 'copy-landing',
  closeBundle() {
    const landingDir = resolve(__dirname, 'dist/landing')
    if (!existsSync(landingDir)) {
      mkdirSync(landingDir, { recursive: true })
    }
    copyFileSync(
      resolve(__dirname, 'landing/styles.css'),
      resolve(__dirname, 'dist/landing/styles.css')
    )
    copyFileSync(
      resolve(__dirname, 'landing/script.js'),
      resolve(__dirname, 'dist/landing/script.js')
    )
  }
})

export default defineConfig({
  plugins: [react(), copyLandingPlugin()],
  root: '.',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  worker: {
    format: 'es',
  },
})
