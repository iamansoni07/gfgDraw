import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'GfgDrawCanvasSdk',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'yjs',
        'y-websocket',
        'y-indexeddb',
        'rbush',
        'lucide-react',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          yjs: 'Y',
          rbush: 'RBush',
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
