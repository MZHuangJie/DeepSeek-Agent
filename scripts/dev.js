const { createServer } = require('vite');
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const viteBin = path.resolve(root, 'node_modules/vite/bin/vite.js');
const electronEntry = path.resolve(root, 'node_modules/electron/dist/electron') + (process.platform === 'win32' ? '.exe' : '');

async function main() {
  // 1. 启动 Vite dev server (renderer)
  const server = await createServer({
    configFile: path.resolve(root, 'vite.renderer.config.ts'),
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  console.log(`[dev] Renderer dev server running at ${url}`);

  // 2. 构建 main
  console.log('[dev] Building main...');
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [viteBin, 'build', '--config', 'vite.main.config.ts'], {
      cwd: root,
      stdio: 'inherit',
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`main build exited ${code}`))));
  });
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.resolve(__dirname, 'fix-electron-build.js')], {
      cwd: root,
      stdio: 'inherit',
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`fix build exited ${code}`))));
  });

  // 3. 构建 preload
  console.log('[dev] Building preload...');
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [viteBin, 'build', '--config', 'vite.preload.config.ts'], {
      cwd: root,
      stdio: 'inherit',
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`preload build exited ${code}`))));
  });

  // 4. 启动 Electron
  console.log('[dev] Starting Electron...');
  const env = { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: 'development' };
  delete env.ELECTRON_RUN_AS_NODE;

  const electron = spawn(electronEntry, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env,
  });

  electron.on('close', (code) => {
    console.log(`[dev] Electron exited with code ${code}`);
    server.close();
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
