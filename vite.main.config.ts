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
      plugins: [
        {
          name: 'fix-electron-import',
          renderChunk(code) {
            // Electron v34+ requires destructured require, not namespace import
            return code.replace(
              'const electron = require("electron");',
              'const { app, BrowserWindow, ipcMain, safeStorage } = require("electron");'
            ).replace(/electron\.app\b/g, 'app').replace(/electron\.BrowserWindow\b/g, 'BrowserWindow').replace(/electron\.ipcMain\b/g, 'ipcMain').replace(/electron\.safeStorage\b/g, 'safeStorage');
          },
        },
      ],
    },
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: process.env.NODE_ENV === 'production',
  },
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(process.env.VITE_DEV_SERVER_URL || ''),
  },
});
