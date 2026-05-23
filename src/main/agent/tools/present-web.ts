// 交互式网页展示 — present_web 工具
// 参数: html(完整HTML), useSystem(是否用系统浏览器，默认false)
// 模型生成交互HTML，用户点击data-action按钮后结果返回模型
import fs from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';
import { presentWebPreview } from '../services/webPreview';
import type { ToolDef } from './index';

export function createPresentWebTool(): ToolDef {
  return {
    name: 'present_web',
    description: '以交互式网页形式展示方案/选项给用户。默认在应用内置浏览器面板中打开。如果用户明确要求使用系统默认浏览器，设置 useSystem=true。当不确定用户偏好时，先询问"用内置浏览器还是系统浏览器？"。',
    parameters: {
      type: 'object',
      properties: {
        html: { type: 'string', description: '完整 HTML 页面代码' },
        useSystem: { type: 'boolean', description: '是否使用系统默认浏览器打开' },
      },
      required: ['html'],
    },
    execute: async (args, context) => {
      const html = args.html as string;
      if (!html.includes('<html') && !html.includes('<body')) throw new Error('请提供完整 HTML');

      if (args.useSystem) {
        const tmp = path.join(os.tmpdir(), `ds-preview-${Date.now()}.html`);
        fs.writeFileSync(tmp, html, 'utf-8');
        shell.openPath(tmp);
        return JSON.stringify({ opened: 'system', file: tmp });
      }

      let sendToRenderer: ((ch: string, data: any) => void) | undefined;
      try { const w = (context as any)?.subAgentManager?.win; if (w && !w.isDestroyed()) sendToRenderer = (ch, d) => w.webContents.send(ch, d); } catch {}
      return JSON.stringify(await presentWebPreview({ html }, context?.signal, sendToRenderer));
    },
  };
}
