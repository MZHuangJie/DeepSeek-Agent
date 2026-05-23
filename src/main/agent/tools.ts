import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { SubAgentManager, SubAgentTask } from './sub-agent';
import { TaskDecomposer } from './task-decomposer';
import { webSearch } from '../services/webSearch';
import { webFetch, webScreenshot } from '../services/browser';
import { presentWebPreview } from '../services/webPreview';
import { describeImage, VisionModelConfig } from '../services/vision';
import { safeResolve, checkSensitiveFile, checkDangerousCommand } from './tools/index';
import type { ToolDef, ToolContext } from './tools/index';
export type { ToolDef, ToolContext };
import { generateImage, ImageModelConfig } from '../services/imageGen';

export function getAllTools(projectDir: string): ToolDef[] {
  return [
    {
      name: 'read_file',
      description: '读取文件内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径（相对于项目根目录或绝对路径）' },
          offset: { type: 'number', description: '开始行号' },
          limit: { type: 'number', description: '读取行数' },
        },
        required: ['path'],
      },
      execute: async (args) => {
        checkSensitiveFile(args.path as string);
        const filePath = safeResolve(projectDir, args.path as string);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const start = ((args.offset as number) ?? 1) - 1;
        const end = args.limit ? start + (args.limit as number) : lines.length;
        return lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
      },
    },
    {
      name: 'write_file',
      description: '写入/创建文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '文件内容' },
        },
        required: ['path', 'content'],
      },
      requiresConfirm: true,
      execute: async (args) => {
        const filePath = safeResolve(projectDir, args.path as string);
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, args.content as string, 'utf-8');
        return `OK`;
      },
    },
    {
      name: 'edit_file',
      description: '精确字符串替换编辑文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          old_string: { type: 'string', description: '要替换的文本' },
          new_string: { type: 'string', description: '替换后的文本' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
      requiresConfirm: true,
      execute: async (args) => {
        const filePath = safeResolve(projectDir, args.path as string);
        let content = fs.readFileSync(filePath, 'utf-8');
        if (!content.includes(args.old_string as string)) {
          throw new Error('old_string 未在文件中找到');
        }
        content = content.replace(args.old_string as string, args.new_string as string);
        fs.writeFileSync(filePath, content, 'utf-8');
        return `OK`;
      },
    },
    {
      name: 'grep',
      description: '在项目中搜索文本',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '搜索正则或文本' },
          path: { type: 'string', description: '搜索路径（默认项目根目录）' },
          glob: { type: 'string', description: '文件过滤 glob，如 *.ts' },
        },
        required: ['pattern'],
      },
      execute: async (args) => {
        const searchPath = args.path ? safeResolve(projectDir, args.path as string) : projectDir;
        const pattern = args.pattern as string;
        const globPattern = (args.glob as string) || '*';
        const results: string[] = [];
        const maxResults = 200;
        function matchGlob(name: string, glob: string): boolean {
          if (glob === '*' || glob === '*.*') return true;
          // 支持 {a,b} 展开
          if (glob.includes('{') && glob.includes('}')) {
            const prefix = glob.slice(0, glob.indexOf('{'));
            const suffix = glob.slice(glob.indexOf('}') + 1);
            const inner = glob.slice(glob.indexOf('{') + 1, glob.indexOf('}'));
            return inner.split(',').some(ext => matchGlob(name, prefix + ext + suffix));
          }
          // 简单通配: *.ts, test*.ts, *test*
          const reStr = '^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
          return new RegExp(reStr, 'i').test(name);
        }
        function searchDir(dir: string, depth: number) {
          if (depth > 10 || results.length >= maxResults) return;
          let entries: fs.Dirent[];
          try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
          for (const entry of entries) {
            if (results.length >= maxResults) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              searchDir(full, depth + 1);
            } else if (entry.isFile() && matchGlob(entry.name, globPattern)) {
              try {
                const content = fs.readFileSync(full, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes(pattern)) {
                    results.push(`${path.relative(projectDir, full)}:${i + 1}: ${lines[i].trim()}`);
                    if (results.length >= maxResults) break;
                  }
                }
              } catch {}
            }
          }
        }
        searchDir(searchPath, 0);
        return results.length > 0 ? results.join('\n') : '未找到匹配项';
      },
    },
    {
      name: 'glob',
      description: '文件模式匹配',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'glob 模式，如 **/*.ts' },
        },
        required: ['pattern'],
      },
      execute: async (args) => {
        const { glob } = await import('glob');
        const files = await glob(args.pattern as string, { cwd: projectDir });
        return files.join('\n');
      },
    },
    {
      name: 'bash',
      description: '执行终端命令',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的命令' },
        },
        required: ['command'],
      },
      requiresConfirm: true,
      execute: async (args) => {
        const { spawnSync } = await import('child_process');
        const command = (args.command as string).trim();
        if (!command) throw new Error('命令不能为空');
        checkDangerousCommand(command);
        const result = spawnSync(command, [], {
          cwd: projectDir,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
          shell: true,
          timeout: 30000,
        });
        if (result.error) throw result.error;
        return (result.stdout || '') + (result.stderr ? `\n[stderr]\n${result.stderr}` : '');
      },
    },
    {
      name: 'list_files',
      description: '列出目录内容',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目录路径（默认项目根目录）' },
        },
      },
      execute: async (args) => {
        const dirPath = args.path ? safeResolve(projectDir, args.path as string) : projectDir;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n');
      },
    },
    {
      name: 'spawn_sub_agent',
      description: '生成子代理处理特定任务。当项目规模较大或需要并行探索多个模块时使用。子代理拥有独立的上下文窗口，可以深入探索特定目录或文件集合。',
      parameters: {
        type: 'object',
        properties: {
          task_type: {
            type: 'string',
            enum: ['explore', 'analyze', 'implement', 'review'],
            description: '任务类型：explore=探索代码结构, analyze=分析特定问题, implement=实现功能, review=代码审查',
          },
          description: {
            type: 'string',
            description: '任务的详细描述，包括目标、要求和期望输出',
          },
          target_path: {
            type: 'string',
            description: '目标路径（相对于项目根目录），如 src/components 或 . 表示整个项目',
          },
          parallel_tasks: {
            type: 'array',
            description: '可选：多个并行任务的数组，每个任务包含 task_type, description, target_path',
            items: {
              type: 'object',
              properties: {
                task_type: { type: 'string', enum: ['explore', 'analyze', 'implement', 'review'] },
                description: { type: 'string' },
                target_path: { type: 'string' },
              },
              required: ['task_type', 'description', 'target_path'],
            },
          },
        },
        required: ['task_type', 'description', 'target_path'],
      },
      requiresConfirm: false,
      execute: async (args, context) => {
        if (!context) {
          throw new Error('spawn_sub_agent 需要 ToolContext（apiKey, modelConfig, contextMax, subAgentManager）');
        }

        const subAgentManager = context.subAgentManager;

        if (args.parallel_tasks && Array.isArray(args.parallel_tasks)) {
          const tasks: SubAgentTask[] = (args.parallel_tasks as Array<{
            task_type: string;
            description: string;
            target_path: string;
          }>).map((t, idx) => ({
            id: `manual-${t.task_type}-${Date.now()}-${idx}`,
            type: t.task_type as 'explore' | 'analyze' | 'implement' | 'review',
            description: t.description,
            targetPath: t.target_path,
            projectDir,
          }));

          const results = await subAgentManager.spawnMultipleSubAgents(
            tasks,
            context.apiKey,
            context.modelConfig,
            context.contextMax
          );

          const summary = results.map((r, idx) => {
            const status = r.success ? '✓ 成功' : '✗ 失败';
            return `
## 子代理 ${idx + 1}: ${tasks[idx].type} - ${tasks[idx].targetPath}
${status}
**处理文件**: ${r.filesProcessed.length} 个
**Token 使用**: ${r.tokenUsage.total}
**摘要**: ${r.summary}
${r.findings.length > 0 ? `**发现**:\n${r.findings.map(f => `- ${f}`).join('\n')}` : ''}
${r.error ? `**错误**: ${r.error}` : ''}
`.trim();
          }).join('\n\n---\n\n');

          return `并行执行了 ${results.length} 个子代理任务:\n\n${summary}`;
        }

        const task: SubAgentTask = {
          id: `manual-${args.task_type}-${Date.now()}`,
          type: args.task_type as 'explore' | 'analyze' | 'implement' | 'review',
          description: args.description as string,
          targetPath: args.target_path as string,
          projectDir,
        };

        const result = await subAgentManager.spawnSubAgent(
          task,
          context.apiKey,
          context.modelConfig,
          context.contextMax
        );

        if (!result.success) {
          return `子代理执行失败:\n错误: ${result.error}\n摘要: ${result.summary}`;
        }

        return `
子代理执行成功:
- 任务类型: ${task.type}
- 目标路径: ${task.targetPath}
- 处理文件: ${result.filesProcessed.length} 个
- Token 使用: ${result.tokenUsage.total}

摘要:
${result.summary}

${result.findings.length > 0 ? `发现:\n${result.findings.map(f => `- ${f}`).join('\n')}` : ''}
`.trim();
      },
    },
    {
      name: 'auto_decompose_task',
      description: '自动分析项目并决定是否需要分解为多个子代理任务。适用于"查看项目"、"分析代码库"等探索性查询。',
      parameters: {
        type: 'object',
        properties: {
          user_query: {
            type: 'string',
            description: '用户的原始查询，如"查看项目代码"、"分析整个代码库"',
          },
        },
        required: ['user_query'],
      },
      requiresConfirm: false,
      execute: async (args, context) => {
        if (!context) {
          throw new Error('auto_decompose_task 需要 ToolContext（apiKey, modelConfig, contextMax, subAgentManager）');
        }

        const taskDecomposer = new TaskDecomposer();
        const strategy = await taskDecomposer.analyzeAndDecompose(
          projectDir,
          args.user_query as string
        );

        if (!strategy.shouldDecompose) {
          return `不需要分解任务:\n${strategy.reason}\n\n建议: 直接使用现有工具（read_file, glob, grep）探索项目。`;
        }

        const subAgentManager = context.subAgentManager;
        const results = await subAgentManager.spawnMultipleSubAgents(
          strategy.tasks,
          context.apiKey,
          context.modelConfig,
          context.contextMax
        );

        const summary = results.map((r, idx) => {
          const task = strategy.tasks[idx];
          const status = r.success ? '✓' : '✗';
          return `${status} ${task.targetPath}: ${r.filesProcessed.length} 个文件, ${r.tokenUsage.total} tokens`;
        }).join('\n');

        const allFindings = results.flatMap(r => r.findings);
        const totalFiles = results.reduce((sum, r) => sum + r.filesProcessed.length, 0);
        const totalTokens = results.reduce((sum, r) => sum + r.tokenUsage.total, 0);

        return `
自动任务分解完成:
${strategy.reason}

执行了 ${strategy.tasks.length} 个子代理任务:
${summary}

总计:
- 处理文件: ${totalFiles} 个
- Token 使用: ${totalTokens}
- 发现数量: ${allFindings.length}

关键发现:
${allFindings.slice(0, 10).map(f => `- ${f}`).join('\n')}
${allFindings.length > 10 ? `\n... 还有 ${allFindings.length - 10} 条发现` : ''}

详细结果:
${results.map((r, idx) => `
## ${strategy.tasks[idx].targetPath}
${r.summary}
`).join('\n')}
`.trim();
      },
    },
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

export function getToolSchemas(tools: ToolDef[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
