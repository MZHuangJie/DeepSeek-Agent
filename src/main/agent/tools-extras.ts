import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { generateImage, ImageModelConfig } from '../services/imageGen';
import { webSearch } from '../services/webSearch';
import { webFetch, webScreenshot } from '../services/browser';
import { presentWebPreview } from '../services/webPreview';
import { describeImage, VisionModelConfig } from '../services/vision';
import { safeResolve } from './tools/index';
import type { ToolDef, ToolContext } from './tools/index';

export function getExtraTools(projectDir: string): ToolDef[] {
  return [
    {
      name: 'generate_image',
      description: '调用生图模型根据描述生成图片。当用户要求生成图片、绘画、创作图像时使用此工具。你需要将用户的描述翻译/优化为高质量的英文 prompt。',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: '高质量的英文图片生成描述。注意：prompt 长度不能超过 4000 字符，超出会被截断。请精简表达，只保留画面核心要素。',
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
            description: '图片尺寸，默认 1024x1024',
          },
          quality: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'auto'],
            description: '图片质量，可选 low/medium/high/auto，默认 auto',
          },
          n: {
            type: 'number',
            description: '生成图片数量（1-4），默认 1',
          },
        },
        required: ['prompt'],
      },
      execute: async (args, context) => {
        if (!context?.imageModelConfig) {
          throw new Error('未配置生图模型，请在模型设置中配置生图 API');
        }
        let prompt = (args.prompt as string).trim();
        if (prompt.length > 4000) {
          prompt = prompt.slice(0, 3997) + '...';
        }
        const result = await generateImage(context.imageModelConfig, {
          prompt,
          size: (args.size as string) || undefined,
          quality: (args.quality as string) || undefined,
          n: (args.n as number) || undefined,
        }, context.signal);
        if (result.urls.length === 0) {
          throw new Error('生图 API 未返回图片 URL');
        }
        // base64 数据存到项目目录，避免撑爆上下文
        const fs = require('fs');
        const path = require('path');
        const displayUrls: string[] = [];
        for (let i = 0; i < result.urls.length; i++) {
          const u = result.urls[i];
          if (u.startsWith('data:')) {
            const imgDir = path.join(context.projectDir || process.cwd(), '.mycli-images');
            fs.mkdirSync(imgDir, { recursive: true });
            const tmpFile = path.join(imgDir, `img-${Date.now()}-${i}.png`);
            const base64Data = u.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(tmpFile, Buffer.from(base64Data, 'base64'));
            displayUrls.push(tmpFile);
          } else {
            displayUrls.push(u);
          }
        }
        return JSON.stringify({
          urls: displayUrls,
          revisedPrompt: result.revisedPrompt,
          hint: '【输出格式要求】你必须在最终回复中，使用 markdown 图片语法直接展示图片，格式为：![图片描述](图片路径)。不要只给文字链接。图片路径就是上面给你的文件路径。',
        });
      },
    },
    {
      name: 'present_choices',
      description: '当你有多个方案或选项需要让用户选择时调用此工具。展示选项列表给用户，用户可多选并附上反馈意见。',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: '向用户展示的提示信息，解释需要用户做出什么选择',
          },
          choices: {
            type: 'array',
            description: '选项列表，每个选项有 label(标签) 和可选的 description(详细说明)',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: '选项的简短标签' },
                description: { type: 'string', description: '选项的详细说明（可选）' },
              },
              required: ['label'],
            },
          },
        },
        required: ['message', 'choices'],
      },
      execute: async (args, context) => {
        if (!context?.subAgentManager) {
          return JSON.stringify({ error: '无法弹出选择框' });
        }
        const win = (context.subAgentManager as any).win;
        if (!win || win.isDestroyed()) {
          return JSON.stringify({ error: '无法弹出选择框' });
        }
        const choiceId = `choice-${Date.now()}`;
        const approved = await new Promise<boolean>((resolve) => {
          let cleaned = false;
          const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            ipcMain.removeListener('agent:choice-response', handler);
            context.signal?.removeEventListener('abort', onAbort);
          };
          const handler = (_ev: any, resp: { choiceId: string; selected: number[]; feedback: string; cancelled: boolean }) => {
            if (resp.choiceId === choiceId) {
              cleanup();
              if (resp.cancelled) {
                resolve(false);
              } else {
                resolve(true);
                // 存下用户的选择和反馈供后续读取
                (context as any)._choiceResult = { selected: resp.selected, feedback: resp.feedback };
              }
            }
          };
          const onAbort = () => {
            cleanup();
            resolve(false);
          };
          ipcMain.on('agent:choice-response', handler);
          context.signal?.addEventListener('abort', onAbort, { once: true });
          win.webContents.send('agent:choice-request', {
            choiceId,
            message: args.message as string,
            choices: args.choices as Array<{ label: string; description?: string }>,
          });
        });
        if (!approved) {
          return JSON.stringify({ cancelled: true });
        }
        const result = (context as any)._choiceResult || { selected: [], feedback: '' };
        (context as any)._choiceResult = undefined;
        const selectedLabels = (args.choices as Array<{ label: string }>)
          .filter((_, i) => result.selected.includes(i))
          .map(c => c.label);
        return JSON.stringify({
          selected: result.selected,
          selectedLabels,
          feedback: result.feedback,
        });
      },
    },
    {
      name: 'web_search',
      description: '搜索互联网，获取最新的网页信息。当需要了解时事、查找资料、验证事实时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词，建议使用简洁的英文关键词以获得更好结果' },
          maxResults: { type: 'number', description: '最大返回结果数，默认 8' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const query = args.query as string;
        const maxResults = (args.maxResults as number) || 8;
        const results = await webSearch(query, maxResults);
        if (results.length === 0) {
          return JSON.stringify({ error: '未找到相关结果' });
        }
        return JSON.stringify({ query, results });
      },
    },
    {
      name: 'web_fetch',
      description: '获取指定网页的文本内容。用于阅读文章、查看文档、提取网页信息。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要访问的网页 URL（完整的 https:// 地址）' },
        },
        required: ['url'],
      },
      execute: async (args, context) => {
        const url = args.url as string;
        if (!url.startsWith('https://') && !url.startsWith('http://')) {
          throw new Error('URL 必须以 https:// 或 http:// 开头');
        }
        const result = await webFetch(url, context?.signal);
        return JSON.stringify({ url: result.url, title: result.title, text: result.text });
      },
    },
    {
      name: 'web_screenshot',
      description: '对指定网页截图，返回 base64 图片数据。用于查看网页外观、验证页面渲染效果。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要截图的网页 URL（完整的 https:// 地址）' },
        },
        required: ['url'],
      },
      execute: async (args, context) => {
        const url = args.url as string;
        if (!url.startsWith('https://') && !url.startsWith('http://')) {
          throw new Error('URL 必须以 https:// 或 http:// 开头');
        }
        const base64 = await webScreenshot(url, context?.signal);
        // 截图存到项目目录
        const imgDir = path.join(context?.projectDir || process.cwd(), '.mycli-images');
        fs.mkdirSync(imgDir, { recursive: true });
        const imgFile = path.join(imgDir, `screenshot-${Date.now()}.png`);
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(imgFile, Buffer.from(base64Data, 'base64'));
        return JSON.stringify({
          url,
          screenshot: `截图已保存到: ${imgFile}`,
          hint: '使用 markdown 图片语法展示截图：![网页截图](图片路径)',
        });
      },
    },
    {
      name: 'present_web',
      description: '以交互式网页的形式展示方案/选项/设计稿给用户。当你需要用户从多个视觉化选项中做选择、或者展示复杂的设计方案时使用。生成的 HTML 页面中，每个可选项需要添加 data-action 属性，用户点击后会返回该选项名称。',
      parameters: {
        type: 'object',
        properties: {
          html: {
            type: 'string',
            description: '完整的 HTML 页面代码。每个可点击的按钮/选项需添加 data-action="选项名称" 属性。可选添加 <input id="feedback"> 让用户填写反馈。',
          },
        },
        required: ['html'],
      },
      execute: async (args, context) => {
        const html = args.html as string;
        if (!html.includes('<html') && !html.includes('<body')) {
          throw new Error('请提供完整的 HTML 页面代码，包含 <html> 和 <body> 标签');
        }
        // 通过 subAgentManager 获取 BrowserWindow 发 IPC 到渲染进程
        let sendToRenderer: ((ch: string, data: any) => void) | undefined;
        try {
          const manager = (context as any)?.subAgentManager;
          const win = manager?.win;
          if (win && !win.isDestroyed()) {
            sendToRenderer = (ch, data) => win.webContents.send(ch, data);
          }
        } catch {}
        const result = await presentWebPreview({ html }, context?.signal, sendToRenderer);
        return JSON.stringify(result);
      },
    },
    {
      name: 'describe_image',
      description: '调用视觉模型描述图片内容。当你看到用户消息中包含图片文件引用（@图片路径）且无法直接理解图片时，使用此工具获取图片的文字描述。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '图片文件的完整路径' },
          prompt: { type: 'string', description: '可选的描述侧重点，如"重点关注图中文字"、"描述图中人物的动作和表情"' },
        },
        required: ['path'],
      },
      execute: async (args, context) => {
        const visionConfig = (context as any)?.visionModelConfig as VisionModelConfig | undefined;
        if (!visionConfig?.enabled || !visionConfig.apiKey) {
          throw new Error('未配置视觉模型，请在模型设置中配置视觉 API（推荐 GPT-4o 或 Claude）');
        }
        const imagePath = args.path as string;
        const prompt = args.prompt as string | undefined;
        const description = await describeImage(visionConfig, imagePath, prompt, context?.signal);
        if (!description || description.trim().length < 10) {
          throw new Error('视觉模型未返回有效描述');
        }
        return `【图片内容描述】\n${description}\n\n---\n请在回复中基于以上描述回答用户关于图片的问题，不要在回复中输出图片路径。`;
      },
    },
  ];
}
