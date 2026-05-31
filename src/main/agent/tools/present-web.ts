// 交互式网页展示 — present_web 工具
// 参数: html(完整HTML), useSystem(是否用系统浏览器，默认false), inline(是否聊天区内嵌，默认false), append(追加模式，默认false)
// 模型生成交互HTML，用户点击data-action按钮后结果返回模型
import fs from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';
import { presentWebPreview } from '../../services/webPreview';
import type { ToolDef } from './index';

export function createPresentWebTool(): ToolDef {
  return {
    name: 'present_web',
    description: '以交互式网页形式展示方案/选项给用户。默认在应用内置浏览器面板中打开。支持分步构建网页：首次调用不设 append，后续调用设置 append=true 追加内容，用户可在聊天区实时看到网页逐步成型的全过程。',
    parameters: {
      type: 'object',
      properties: {
        html: { type: 'string', description: '完整 HTML 页面代码，或要追加的 HTML 片段（append=true 时）' },
        useSystem: { type: 'boolean', description: '是否使用系统默认浏览器打开' },
        inline: { type: 'boolean', description: '是否在聊天区内嵌展示（默认 false）。分步构建网页时建议设为 true' },
        append: { type: 'boolean', description: '是否追加到已有预览后（默认 false=新建/替换），用于分步构建网页' },
      },
      required: ['html'],
    },
    execute: async (args, context) => {
      const html = args.html as string;
      const isAppend = args.append === true;
      if (!isAppend && !html.includes('<html') && !html.includes('<body')) {
        if (!args.inline) throw new Error('请提供完整 HTML（开发网页请设置 inline:true 分步构建）');
      }

      if (args.useSystem) {
        const tmp = path.join(os.tmpdir(), `ds-preview-${Date.now()}.html`);
        fs.writeFileSync(tmp, html, 'utf-8');
        shell.openPath(tmp);
        return JSON.stringify({ opened: 'system', file: tmp });
      }

      // inline 模式：跳过浏览器面板，由 ipc/agent.ts 转发到聊天区
      if (args.inline) {
        return JSON.stringify({ opened: 'inline', htmlLength: html.length, append: !!args.append });
      }

      let sendToRenderer: ((ch: string, data: any) => void) | undefined;
      try { const w = (context as any)?.subAgentManager?.win; if (w && !w.isDestroyed()) sendToRenderer = (ch, d) => w.webContents.send(ch, d); } catch {}
      return JSON.stringify(await presentWebPreview({ html }, context?.signal, sendToRenderer));
    },
  };
}
