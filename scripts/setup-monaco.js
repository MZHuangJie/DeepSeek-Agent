const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../node_modules/monaco-editor/min/vs');
const dest = path.join(__dirname, '../public/vs');

if (!fs.existsSync(src)) {
  console.warn('[setup-monaco] monaco-editor/min/vs not found, skipping');
  process.exit(0);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(src, dest);
console.log('[setup-monaco] copied monaco-editor/min/vs -> public/vs');
