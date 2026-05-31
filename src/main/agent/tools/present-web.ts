// 交互式网页展示 — present_web 工具
// inline+html: 聊天区内嵌预览
// inline+file: 监听文件变化自动推送预览（实时开发模式）
import fs from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';
import { presentWebPreview } from '../../services/webPreview';
import type { ToolDef } from './index';

export function createPresentWebTool(): ToolDef {
  return {
    name: 'present_web',
    description: '展示网页给用户。支持三种模式：1) 聊天区内嵌预览（inline:true + html）；2) 实时开发预览（inline:true + file，监听文件变化自动更新）；3) 系统浏览器打开（useSystem:true）',
    parameters: {
      type: 'object',
      properties: {
        html: { type: 'string', description: '完整 HTML 页面代码。inline=true 时必填，除非使用 file 模式' },
        file: { type: 'string', description: '要监听并实时预览的 HTML 文件路径（inline=true 时可用，与 html 二选一）' },
        useSystem: { type: 'boolean', description: '是否使用系统默认浏览器打开' },
        inline: { type: 'boolean', description: '是否在聊天区内嵌展示（推荐 true）' },
      },
      required: [],
    },
    execute: async (args, context) => {
      const html = args.html as string | undefined;
      const filePath = args.file as string | undefined;
      const isInline = args.inline === true;

      // 系统浏览器模式
      if (args.useSystem) {
        const content = html || (filePath ? fs.readFileSync(filePath, 'utf-8') : '');
        if (!content) throw new Error('请提供 html 或 file 参数');
        const tmp = path.join(os.tmpdir(), `ds-preview-${Date.now()}.html`);
        fs.writeFileSync(tmp, content, 'utf-8');
        shell.openPath(tmp);
        return JSON.stringify({ opened: 'system', file: tmp });
      }

      // 实时开发预览：监听文件变化
      if (isInline && filePath) {
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) throw new Error(`文件不存在: ${resolved}`);
        const initialHtml = fs.readFileSync(resolved, 'utf-8');
        return JSON.stringify({ opened: 'watch', file: resolved, initialHtml });
      }

      // 内嵌 HTML 预览
      if (isInline && html) {
        return JSON.stringify({ opened: 'inline', html, htmlLength: html.length });
      }

      // 默认：交互式预览（启动 HTTP 服务器 + 内置浏览器）
      if (!html) throw new Error('请提供 html 参数');
      let sendToRenderer: ((ch: string, data: any) => void) | undefined;
      try { const w = (context as any)?.subAgentManager?.win; if (w && !w.isDestroyed()) sendToRenderer = (ch, d) => w.webContents.send(ch, d); } catch {}
      return JSON.stringify(await presentWebPreview({ html }, context?.signal, sendToRenderer));
    },
  };
}
