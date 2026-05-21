import http from 'http';
import { BrowserWindow, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface WebPreviewOptions {
  html: string;
  timeout?: number; // ms, default 10 minutes
}

interface WebPreviewResult {
  action: string;      // 用户点击的按钮/选项名
  value?: string;      // 用户输入的值（如果有输入框）
  feedback?: string;   // 用户填写的反馈文本
}

export async function presentWebPreview(
  options: WebPreviewOptions,
  signal?: AbortSignal
): Promise<WebPreviewResult> {
  const { html, timeout = 600_000 } = options;

  // 注入交互脚本：页面中的按钮点击后发送 POST 到服务器
  const injectedHtml = html.replace('</body>', `
<script>
// 所有带有 data-action 属性的按钮点击时发送选择
document.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    const feedback = document.getElementById('feedback')?.value || '';
    const extraValue = document.getElementById('choice-value')?.value || '';
    try {
      await fetch('/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback, value: extraValue })
      });
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;font-size:18px;">已收到选择：<strong>' + action + '</strong><br>可以关闭此页面了</div>';
    } catch(e) {
      document.body.innerHTML = '<div style="color:red;padding:20px;">提交失败：' + e.message + '</div>';
    }
  });
});
// 自动调整 form layout
document.querySelectorAll('form').forEach(f => {
  f.addEventListener('submit', e => e.preventDefault());
  const submitBtn = f.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn) {
    const firstBtn = document.querySelector('[data-action]');
    if (!firstBtn) {
      submitBtn.setAttribute('data-action', submitBtn.textContent?.trim() || '提交');
    }
  }
});
</script>
</body>`);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(injectedHtml);
      } else if (req.method === 'POST' && req.url === '/select') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          try {
            const data = JSON.parse(body);
            resolve({
              action: data.action || '未知',
              value: data.value,
              feedback: data.feedback,
            });
          } catch {
            resolve({ action: '解析失败' });
          }
          server.close();
          try { win?.destroy(); } catch {}
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    let win: BrowserWindow | null = null;

    const cleanup = () => {
      server.close();
      try { win?.destroy(); } catch {}
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('网页预览超时'));
    }, timeout);

    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        cleanup();
        reject(new Error('服务器启动失败'));
        return;
      }
      const port = addr.port;
      const url = `http://127.0.0.1:${port}`;

      // 用 Electron BrowserWindow 打开
      win = new BrowserWindow({
        width: 1000,
        height: 700,
        title: '方案预览 - 点击选项进行选择',
        webPreferences: { javascript: true },
      });

      win.on('closed', () => {
        win = null;
        clearTimeout(timer);
        server.close();
        resolve({ action: '用户关闭了窗口' });
      });

      win.loadURL(url).catch(err => {
        cleanup();
        reject(new Error(`打开预览窗口失败: ${err.message}`));
      });
    });

    server.on('error', (err) => {
      cleanup();
      reject(new Error(`服务器错误: ${err.message}`));
    });
  });
}
