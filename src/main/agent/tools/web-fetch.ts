// 网页内容抓取 — web_fetch 工具
// 参数: url
// Electron隐藏窗口抓取文本内容
import { validateExternalUrl } from '../../security/url';
import { webFetch } from '../../services/browser';
import type { ToolDef } from './index';

export function createWebFetchTool(): ToolDef {
  return {
    name: 'web_fetch', description: '获取网页文本内容',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    execute: async (args, context) => {
      const url = args.url as string;
      validateExternalUrl(url);
      const r = await webFetch(url, context?.signal);
      return JSON.stringify({ url: r.url, title: r.title, text: r.text });
    },
  };
}
