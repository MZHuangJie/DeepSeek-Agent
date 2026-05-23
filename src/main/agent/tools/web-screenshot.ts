import fs from 'fs';
import path from 'path';
import { webScreenshot } from '../services/browser';
import type { ToolDef } from './index';

export function createWebScreenshotTool(): ToolDef {
  return {
    name: 'web_screenshot', description: '对网页截图',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    execute: async (args, context) => {
      const url = args.url as string;
      if (!url.startsWith('http')) throw new Error('URL 必须以 http/https 开头');
      const base64 = await webScreenshot(url, context?.signal);
      const imgDir = path.join(context?.projectDir || process.cwd(), '.deepseek-agent-images');
      fs.mkdirSync(imgDir, { recursive: true });
      const imgFile = path.join(imgDir, `screenshot-${Date.now()}.png`);
      fs.writeFileSync(imgFile, Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      return JSON.stringify({ url, screenshot: imgFile, hint: '使用 markdown 图片语法展示：![网页截图](路径)' });
    },
  };
}
