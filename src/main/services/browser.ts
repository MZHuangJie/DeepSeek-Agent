import { BrowserWindow } from 'electron';
import { validateExternalUrl } from '../security/url';

interface BrowserResult {
  url: string;
  title: string;
  text: string;
}

export async function webFetch(url: string, signal?: AbortSignal): Promise<BrowserResult> {
  const safeUrl = validateExternalUrl(url).href;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { javascript: true, images: false },
  });

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      try { win.destroy(); } catch {}
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      try { win.destroy(); } catch {}
      reject(new Error('页面加载超时（30秒）'));
    }, 30000);

    win.webContents.on('did-finish-load', async () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      try {
        const title = win.getTitle();
        // 注入脚本提取页面文本
        const text = await win.webContents.executeJavaScript(`
          (function() {
            // 移除 script 和 style
            document.querySelectorAll('script, style, nav, footer, header, aside').forEach(e => e.remove());
            return document.body?.innerText || document.documentElement?.innerText || '';
          })()
        `);
        win.destroy();
        // 截取前 8000 字符
        resolve({ url: safeUrl, title, text: text.slice(0, 8000) });
      } catch (err: any) {
        try { win.destroy(); } catch {}
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', (_event, _code, desc) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      try { win.destroy(); } catch {}
      reject(new Error(`页面加载失败: ${desc}`));
    });

    try {
      win.loadURL(safeUrl).catch((err) => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        try { win.destroy(); } catch {}
        reject(err);
      });
    } catch (err) {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      try { win.destroy(); } catch {}
      reject(err as Error);
    }
  });
}

export async function webScreenshot(url: string, signal?: AbortSignal): Promise<string> {
  const safeUrl = validateExternalUrl(url).href;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { javascript: true, images: true },
  });

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      try { win.destroy(); } catch {}
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      try { win.destroy(); } catch {}
      reject(new Error('截图超时（30秒）'));
    }, 30000);

    win.webContents.on('did-finish-load', async () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      try {
        // 等 1 秒让页面渲染完成
        await new Promise(r => setTimeout(r, 1000));
        const img = await win.webContents.capturePage();
        const base64 = img.toDataURL();
        win.destroy();
        resolve(base64);
      } catch (err: any) {
        try { win.destroy(); } catch {}
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', (_event, _code, desc) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      try { win.destroy(); } catch {}
      reject(new Error(`页面加载失败: ${desc}`));
    });

    try {
      win.loadURL(safeUrl).catch((err) => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        try { win.destroy(); } catch {}
        reject(err);
      });
    } catch (err) {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      try { win.destroy(); } catch {}
      reject(err as Error);
    }
  });
}
