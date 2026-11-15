import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@excalidraw/excalidraw/index.css': path.resolve(
        __dirname,
        'node_modules/@excalidraw/excalidraw/dist/dev/index.css',
      ),
    },
  },
})
