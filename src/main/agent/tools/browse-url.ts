// 打开网址 — browse_url 工具
// 参数: url(完整网址), useSystem(是否用系统浏览器，默认false=内置浏览器)
// 使用场景: 用户要求查看网页时，先询问"用内置浏览器还是系统浏览器？"再调用
import { shell } from 'electron';
import type { ToolDef } from './index';

export function createBrowseUrlTool(): ToolDef {
  return {
    name: 'browse_url',
    description: '打开指定网址。默认在应用内置浏览器面板中打开。如果用户明确要求使用系统默认浏览器，设置 useSystem=true。当不确定用户偏好时，先询问"用内置浏览器还是系统浏览器？"再调用。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '完整的 URL，如 https://example.com' },
        useSystem: { type: 'boolean', description: '是否使用系统默认浏览器打开，默认 false（内置浏览器）' },
      },
      required: ['url'],
    },
    execute: async (args, context) => {
      const url = (args.url as string).trim();
      if (!url.startsWith('http')) throw new Error('URL 必须以 http/https 开头');
      if (args.useSystem) {
        shell.openExternal(url);
        return `已在系统浏览器中打开: ${url}`;
      }
      try {
        const { subAgentManager } = context as any;
        const win = subAgentManager?.win;
        if (win && !win.isDestroyed()) win.webContents.send('browser:load-url', { url });
      } catch {
        shell.openExternal(url);
      }
      return `已在内置浏览器中打开: ${url}`;
    },
  };
}
