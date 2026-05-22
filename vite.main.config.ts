import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.join(__dirname, 'src', 'main'),
  build: {
    outDir: path.join(__dirname, 'dist', 'main'),
    lib: {
      entry: path.join(__dirname, 'src', 'main', 'index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'node-pty',
        'child_process',
        'fs',
        'path',
        'crypto',
        'http',
        'https',
        'os',
        'util',
        'glob',
        'minipass',
        'path-scurry',
      ],
      plugins: [],
    },
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: process.env.NODE_ENV === 'production',
  },
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(process.env.VITE_DEV_SERVER_URL || ''),
  },
});
