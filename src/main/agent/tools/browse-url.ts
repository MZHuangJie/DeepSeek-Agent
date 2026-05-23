// 内置浏览器打开 — browse_url 工具
// 参数: url(完整网址)
// 在左侧浏览器面板打开，不弹外部窗口
import type { ToolDef } from './index';

export function createBrowseUrlTool(): ToolDef {
  return {
    name: 'browse_url',
    description: '在应用内置浏览器面板中打开指定网址',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    execute: async (args, context) => {
      const url = (args.url as string).trim();
      if (!url.startsWith('http')) throw new Error('URL 必须以 http/https 开头');
      try {
        const { subAgentManager } = context as any;
        const win = subAgentManager?.win;
        if (win && !win.isDestroyed()) win.webContents.send('browser:load-url', { url });
      } catch {}
      return `已在内置浏览器中打开: ${url}`;
    },
  };
}
