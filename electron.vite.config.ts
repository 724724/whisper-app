import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      lib: { entry: resolve(__dirname, 'electron/main/index.ts') }
    }
  },
  preload: {
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      rollupOptions: { input: resolve(__dirname, 'electron/preload/index.ts') }
    }
  },
  renderer: {
    root: resolve(__dirname, 'front'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'front/index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('front/src'),
        '@shared': resolve('shared')
      }
    },
    plugins: [react()]
  }
})
