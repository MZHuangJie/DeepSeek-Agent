import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.join(__dirname, 'src', 'preload'),
  build: {
    outDir: path.join(__dirname, 'dist', 'preload'),
    lib: {
      entry: path.join(__dirname, 'src', 'preload', 'index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['electron'],
    },
    sourcemap: true,
    minify: false,
  },
});
