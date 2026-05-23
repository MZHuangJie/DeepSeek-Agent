// 图片识别 — describe_image 工具
// 参数: path(图片路径), prompt(可选)
// 调用Vision模型描述图片内容
import { describeImage, VisionModelConfig } from '../../services/vision';
import type { ToolDef } from './index';

export function createDescribeImageTool(): ToolDef {
  return {
    name: 'describe_image', description: '调用视觉模型描述图片内容',
    parameters: { type: 'object', properties: { path: { type: 'string' }, prompt: { type: 'string' } }, required: ['path'] },
    execute: async (args, context) => {
      const cfg = (context as any)?.visionModelConfig as VisionModelConfig | undefined;
      if (!cfg?.enabled || !cfg.apiKey) throw new Error('未配置视觉模型');
      const desc = await describeImage(cfg, args.path as string, args.prompt as string | undefined, context?.signal);
      if (!desc || desc.trim().length < 10) throw new Error('视觉模型未返回有效描述');
      return `【图片内容描述】\n${desc}\n\n---\n请在回复中基于以上描述回答用户关于图片的问题，不要在回复中输出图片路径。`;
    },
  };
}
