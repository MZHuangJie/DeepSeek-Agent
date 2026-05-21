import http from 'http';
import { BrowserWindow } from 'electron';

interface WebPreviewOptions {
  html: string;
  timeout?: number;
}

interface WebPreviewResult {
  action: string;
  value?: string;
  feedback?: string;
}

export async function presentWebPreview(
  options: WebPreviewOptions,
  signal?: AbortSignal,
  sendToRenderer?: (channel: string, data: any) => void
): Promise<WebPreviewResult> {
  const { html, timeout = 600_000 } = options;

  const injectedHtml = html.replace('</body>', `
<script>
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
document.querySelectorAll('form').forEach(f => {
  f.addEventListener('submit', e => e.preventDefault());
  const submitBtn = f.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn && !document.querySelector('[data-action]')) {
    submitBtn.setAttribute('data-action', submitBtn.textContent?.trim() || '提交');
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
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    const cleanup = () => {
      server.close();
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

      // 通知渲染进程在嵌入式浏览器中打开
      if (sendToRenderer) {
        sendToRenderer('browser:load-url', { url });
      } else {
        // fallback: 新窗口
        const win = new BrowserWindow({
          width: 1000, height: 700,
          title: '方案预览',
          webPreferences: { javascript: true },
        });
        win.on('closed', () => {
          win.destroy();
          clearTimeout(timer);
          server.close();
          resolve({ action: '用户关闭了窗口' });
        });
        win.loadURL(url).catch(err => {
          cleanup();
          reject(new Error(`打开预览窗口失败: ${err.message}`));
        });
      }
    });

    server.on('error', (err) => {
      cleanup();
      reject(new Error(`服务器错误: ${err.message}`));
    });
  });
}
