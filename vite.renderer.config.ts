import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: path.join(__dirname, 'src', 'renderer'),
  base: './',
  publicDir: path.join(__dirname, 'public'),
  build: {
    outDir: path.join(__dirname, 'dist', 'renderer'),
    rollupOptions: {
      input: path.join(__dirname, 'src', 'renderer', 'index.html'),
    },
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: process.env.NODE_ENV === 'production',
  },
  plugins: [react()],
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(process.env.VITE_DEV_SERVER_URL || ''),
  },
});
