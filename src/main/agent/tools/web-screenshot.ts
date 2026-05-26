// 网页截图 — web_screenshot 工具
// 参数: url
// Electron窗口截图存到.deepseek-agent-images/
import fs from 'fs';
import path from 'path';
import { validateExternalUrl } from '../../security/url';
import { webScreenshot } from '../../services/browser';
import type { ToolDef } from './index';

export function createWebScreenshotTool(): ToolDef {
  return {
    name: 'web_screenshot', description: '对网页截图',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    execute: async (args, context) => {
      const url = args.url as string;
      validateExternalUrl(url);
      const base64 = await webScreenshot(url, context?.signal);
      const imgDir = path.join(context?.projectDir || process.cwd(), '.deepseek-agent-images');
      fs.mkdirSync(imgDir, { recursive: true });
      const imgFile = path.join(imgDir, `screenshot-${Date.now()}.png`);
      fs.writeFileSync(imgFile, Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      return JSON.stringify({ url, screenshot: imgFile, hint: '使用 markdown 图片语法展示：![网页截图](路径)' });
    },
  };
}
