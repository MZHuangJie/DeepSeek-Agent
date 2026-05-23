import { presentWebPreview } from '../services/webPreview';
import type { ToolDef } from './index';

export function createPresentWebTool(): ToolDef {
  return {
    name: 'present_web', description: '以交互式网页形式展示方案/选项给用户',
    parameters: { type: 'object', properties: { html: { type: 'string' } }, required: ['html'] },
    execute: async (args, context) => {
      const html = args.html as string;
      if (!html.includes('<html') && !html.includes('<body')) throw new Error('请提供完整 HTML');
      let sendToRenderer: ((ch: string, data: any) => void) | undefined;
      try { const w = (context as any)?.subAgentManager?.win; if (w && !w.isDestroyed()) sendToRenderer = (ch, d) => w.webContents.send(ch, d); } catch {}
      return JSON.stringify(await presentWebPreview({ html }, context?.signal, sendToRenderer));
    },
  };
}
