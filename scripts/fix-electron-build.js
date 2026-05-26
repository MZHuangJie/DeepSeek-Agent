const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'main', 'index.js');
if (!fs.existsSync(file)) {
  console.log('dist/main/index.js not found, skipping');
  process.exit(0);
}

let code = fs.readFileSync(file, 'utf-8');
const original = code;

// Match both minified and unminified require("electron")
const requireRe = /const\s+(\w+)\s*=\s*require\("electron"\)/;
const m = code.match(requireRe);
if (m) {
  const varName = m[1];
  code = code.replace(requireRe, 'const{app,BrowserWindow,ipcMain,safeStorage,dialog,shell}=require("electron")');
  code = code.replace(new RegExp(varName + '\\.app\\b', 'g'), 'app');
  code = code.replace(new RegExp(varName + '\\.BrowserWindow\\b', 'g'), 'BrowserWindow');
  code = code.replace(new RegExp(varName + '\\.ipcMain\\b', 'g'), 'ipcMain');
  code = code.replace(new RegExp(varName + '\\.safeStorage\\b', 'g'), 'safeStorage');
  code = code.replace(new RegExp(varName + '\\.dialog\\b', 'g'), 'dialog');
  code = code.replace(new RegExp(varName + '\\.shell\\b', 'g'), 'shell');
}

if (code !== original) {
  fs.writeFileSync(file, code, 'utf-8');
  console.log('[fix-electron-build] Fixed electron imports in dist/main/index.js');
} else {
  console.log('[fix-electron-build] No changes needed');
}

const askpassFiles = ['git-askpass.cjs', 'git-askpass.cmd', 'git-askpass.sh'];
const utilsDir = path.join(__dirname, '..', 'src', 'main', 'utils');
const distMainDir = path.join(__dirname, '..', 'dist', 'main');
for (const name of askpassFiles) {
  const src = path.join(utilsDir, name);
  const dest = path.join(distMainDir, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[fix-electron-build] Copied ${name} -> dist/main/`);
  }
}
