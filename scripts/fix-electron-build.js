const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'main', 'index.js');
if (!fs.existsSync(file)) {
  console.log('dist/main/index.js not found, skipping');
  process.exit(0);
}

let code = fs.readFileSync(file, 'utf-8');
const original = code;

code = code.replace(
  'const electron = require("electron");',
  'const { app, BrowserWindow, ipcMain, safeStorage, dialog } = require("electron");'
);
code = code.replace(/electron\.app\b/g, 'app');
code = code.replace(/electron\.BrowserWindow\b/g, 'BrowserWindow');
code = code.replace(/electron\.ipcMain\b/g, 'ipcMain');
code = code.replace(/electron\.safeStorage\b/g, 'safeStorage');
code = code.replace(/electron\.dialog\b/g, 'dialog');

if (code !== original) {
  fs.writeFileSync(file, code, 'utf-8');
  console.log('[fix-electron-build] Fixed electron imports in dist/main/index.js');
} else {
  console.log('[fix-electron-build] No changes needed');
}
