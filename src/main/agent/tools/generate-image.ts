// AI生图 — generate_image 工具
// 参数: prompt, size, quality, n
// 调用生图模型，base64存项目目录
import fs from 'fs';
import path from 'path';
import { generateImage, ImageModelConfig } from '../../services/imageGen';
import { getAgentImagesDir, toDisplayPath } from '../../services/agent-images';
import type { ToolDef } from './index';

export function createGenerateImageTool(): ToolDef {
  return {
    name: 'generate_image', description: '调用生图模型生成图片',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024', '1792x1024', '1024x1792'] },
        quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, n: { type: 'number' },
      },
      required: ['prompt'],
    },
    execute: async (args, context) => {
      const cfg = (context as any)?.imageModelConfig as ImageModelConfig | undefined;
      if (!cfg) throw new Error('未配置生图模型');
      const r = await generateImage(cfg, { prompt: args.prompt as string, size: args.size as string, quality: args.quality as string, n: args.n as number }, context?.signal);
      if (r.urls.length === 0) throw new Error('生图 API 未返回 URL');
      const displayUrls: string[] = [];
      for (let i = 0; i < r.urls.length; i++) {
        const u = r.urls[i];
        if (u.startsWith('data:')) {
          const dir = getAgentImagesDir(context?.projectDir || process.cwd());
          const f = path.join(dir, `img-${Date.now()}-${i}.png`);
          fs.writeFileSync(f, Buffer.from(u.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
          displayUrls.push(toDisplayPath(f));
        } else { displayUrls.push(u); }
      }
      return JSON.stringify({ urls: displayUrls, revisedPrompt: r.revisedPrompt, hint: '使用 ![描述](路径) 展示图片' });
    },
  };
}
