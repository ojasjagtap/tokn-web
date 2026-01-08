import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { cpSync } from 'fs'

// Plugin to copy static folders to dist
const copyStaticFolders = () => ({
  name: 'copy-static-folders',
  closeBundle() {
    // Copy landing folder
    const landingDest = resolve(__dirname, 'dist/landing')
    cpSync(
      resolve(__dirname, 'landing'),
      landingDest,
      { recursive: true }
    )

    // Copy renderer folder (contains main app logic)
    const rendererDest = resolve(__dirname, 'dist/renderer')
    cpSync(
      resolve(__dirname, 'renderer'),
      rendererDest,
      { recursive: true }
    )

    // Copy flows folder (workflow examples)
    const flowsDest = resolve(__dirname, 'dist/flows')
    cpSync(
      resolve(__dirname, 'flows'),
      flowsDest,
      { recursive: true }
    )

    // Copy src folder (needed by renderer for imports)
    const srcDest = resolve(__dirname, 'dist/src')
    cpSync(
      resolve(__dirname, 'src'),
      srcDest,
      { recursive: true }
    )
  }
})

export default defineConfig({
  plugins: [react(), copyStaticFolders()],
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
