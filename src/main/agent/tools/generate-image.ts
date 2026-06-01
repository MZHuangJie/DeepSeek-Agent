// AI生图 — generate_image 工具
// 参数: prompt, size, quality, n, referenceImages
// 调用生图模型，base64存项目目录
import fs from 'fs';
import path from 'path';
import { generateImage, ImageModelConfig } from '../../services/imageGen';
import { getAgentImagesDir, toDisplayPath } from '../../services/agent-images';
import { safeResolve } from './security';
import type { ToolDef } from './index';

export function createGenerateImageTool(): ToolDef {
  return {
    name: 'generate_image', description: '调用生图模型生成图片',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' }, size: { type: 'string', enum: ['1024x1024', '1792x1024', '1024x1792'] },
        quality: { type: 'string', enum: ['low', 'medium', 'high', 'auto'] }, n: { type: 'number' },
        referenceImages: {
          type: 'array',
          items: { type: 'string' },
          description: '参考图列表，支持本地文件路径或URL',
        },
      },
      required: ['prompt'],
    },
    execute: async (args, context) => {
      const cfg = (context as any)?.imageModelConfig as ImageModelConfig | undefined;
      if (!cfg) throw new Error('未配置生图模型');
      // 解析参考图：本地路径转 base64 data URI，URL 透传
      if (!Array.isArray(args.referenceImages)) {
        throw new Error('referenceImages 必须是字符串数组');
      }
      const rawRefs = args.referenceImages as string[];
      const referenceImages: string[] = [];
      const projectDir = context?.projectDir || process.cwd();
      for (const ref of rawRefs) {
        if (typeof ref !== 'string' || !ref.trim()) continue;
        if (/^https?:\/\//i.test(ref) || ref.startsWith('data:')) {
          referenceImages.push(ref);
        } else {
          try {
            const resolved = safeResolve(projectDir, ref);
            const ext = path.extname(ref).toLowerCase().replace('.', '');
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
              : ext === 'svg' ? 'image/svg+xml'
              : `image/${ext || 'png'}`;
            const buf = fs.readFileSync(resolved);
            referenceImages.push(`data:${mime};base64,${buf.toString('base64')}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`参考图文件不存在或无法读取: ${ref} (${msg})`);
          }
        }
      }
      const r = await generateImage(cfg, {
        prompt: args.prompt as string,
        size: args.size as string,
        quality: args.quality as string,
        n: args.n as number,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      }, context?.signal);
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
