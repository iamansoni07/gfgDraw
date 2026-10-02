import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  resolve: {
    alias: {
      '@excalidraw/excalidraw/index.css': path.resolve(
        __dirname,
        'node_modules/@excalidraw/excalidraw/dist/dev/index.css',
      ),
    },
  },
})
