import https from 'https';
import { ipcMain } from 'electron';
import { getApiKey, saveApiKey } from '../security/keystore';
import { getSetting, setSetting } from '../db/settings';
import { saveSession, loadSessions, deleteSession } from '../db/sessions';
import { generateSessionTitle } from '../services/sessionTitle';

export function setupSettingsHandlers() {
  ipcMain.handle('settings:get', async (_event, key: string) => getSetting(key));
  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    setSetting(key, value);
    return { success: true };
  });
  ipcMain.handle('settings:getApiKey', async () => getApiKey());
  ipcMain.handle('settings:setApiKey', async (_event, key: string) => {
    saveApiKey(key);
    return { success: true };
  });

  ipcMain.handle('settings:getBalance', async () => {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false as const, error: '未配置 API Key' };

    try {
      const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const url = new URL('https://api.deepseek.com/user/balance');
        const req = https.request({
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }, (res) => {
          let body = '';
          res.setEncoding('utf-8');
          res.on('data', (chunk: string) => { body += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              let detail = body;
              try { const p = JSON.parse(detail); detail = p.error?.message || p.message || detail; } catch {}
              reject(new Error(`API 返回 ${res.statusCode}: ${detail}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error('解析余额数据失败'));
            }
          });
        });
        req.on('error', (err) => reject(new Error(`请求失败: ${err.message}`)));
        req.setTimeout(10_000, () => { req.destroy(new Error('余额查询超时')); });
        req.end();
      });

      // DeepSeek 返回格式: { is_available: true, balance_infos: [...], ... }
      // 注意：total_balance / granted_balance 等字段是字符串，不是数字
      const infos = data.balance_infos as Array<Record<string, unknown>> | undefined;
      const currencyInfo = infos?.find((i) => i.currency === 'CNY') ?? infos?.[0];
      const balance = Number(currencyInfo?.total_balance ?? 0);
      const used = Number(currencyInfo?.topped_up_balance ?? 0);

      return {
        success: true as const,
        data: {
          balance: Math.round(balance * 100) / 100,
          monthlyUsed: Math.round(used * 100) / 100,
          monthlyBudget: 0, // DeepSeek 不提供月度预算，UI 会隐藏进度条
          lastUpdated: Date.now(),
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle('sessions:save', async (_event, id: string, title: string, messages: string) => {
    saveSession(id, title, messages);
    return { success: true };
  });
  ipcMain.handle('sessions:loadAll', async () => loadSessions());
  ipcMain.handle('sessions:delete', async (_event, id: string) => {
    deleteSession(id);
    return { success: true };
  });

  ipcMain.handle('sessions:generateTitle', async (_event, payload: {
    userMessage: string;
    assistantPreview?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
  }) => {
    const apiKey = payload.apiKey || getApiKey();
    if (!apiKey) return { success: false as const, error: '未配置 API Key' };

    try {
      const title = await generateSessionTitle(
        apiKey,
        {
          model: payload.model || 'deepseek-v4-flash',
          baseUrl: payload.baseUrl || 'https://api.deepseek.com',
        },
        payload.userMessage,
        payload.assistantPreview,
      );
      return { success: true as const, title };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: message };
    }
  });
}
