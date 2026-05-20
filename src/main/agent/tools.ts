import fs from 'fs';
import path from 'path';
import { SubAgentManager, SubAgentTask } from './sub-agent';
import { TaskDecomposer } from './task-decomposer';
import { ModelConfig } from './client';
import { generateImage, ImageModelConfig } from '../services/imageGen';

function safeResolve(baseDir: string, targetPath: string): string {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(baseDir)) {
    throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
  }
  // 解析符号链接防止绕过
  try {
    const realPath = fs.realpathSync(resolved);
    const realBase = fs.realpathSync(baseDir);
    if (!realPath.startsWith(realBase + path.sep) && realPath !== realBase) {
      throw new Error(`路径越界: ${targetPath} 不在项目目录内`);
    }
    return realPath;
  } catch (e: any) {
    if (e.message?.includes('路径越界')) throw e;
    // 文件不存在时 realpathSync 会失败，回退到普通检查
    return resolved;
  }
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<string>;
  requiresConfirm?: boolean;
}

export interface ToolContext {
  apiKey: string;
  modelConfig: ModelConfig;
  contextMax: number;
  subAgentManager: SubAgentManager;
  imageModelConfig?: ImageModelConfig;
}

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
        const fileName = path.basename(args.path as string);
        const SENSITIVE_NAMES = ['.env', '.env.local', '.env.production', '.env.development',
          'id_rsa', 'id_ed25519', 'id_ecdsa', 'credentials.json', '.credentials',
          '.npmrc', '.pypirc', 'authorized_keys', 'known_hosts',
        ];
        const SENSITIVE_EXTS = ['.pem', '.key', '.pfx', '.p12', '.jks', '.keystore'];
        const ext = path.extname(fileName);
        if (SENSITIVE_NAMES.includes(fileName) || SENSITIVE_EXTS.includes(ext)) {
          throw new Error('读取敏感文件被拒绝');
        }
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
        return `文件已写入: ${filePath}`;
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
        return `文件已编辑: ${filePath}`;
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

        const dangerousPatterns = [
          // 权限提升
          /\bsudo\b/i, /\bdoas\b/i,
          // 破坏系统文件系统
          /\brm\s+-rf\s+\//i, /\brm\s+-rf\s+~\//i,
          /\bdd\s+if=/i, /\bmkfs\.?\s/i,
          // 写磁盘设备
          />[\s]*\/dev\/(sd|hd|nvme|xvd|vd|mmcblk)/i,
          // chmod 777 递归
          /\bchmod\s+-R\s+777\b/i,
          // fork bomb
          /:\(\)\s*\{/,
          // 下载并管道到 shell
          /\b(curl|wget)\b.+\|\s*(ba)?sh\b/i,
          // 网络后门监听
          /\bnc\s+-[e|l]\s/i, /\bncat\s+-[e|l]\s/i,
        ];
        for (const pattern of dangerousPatterns) {
          if (pattern.test(command)) {
            throw new Error('命令包含危险操作，已被拒绝');
          }
        }
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
            description: '高质量的英文图片生成描述，建议详细描述画面内容、风格、构图、光影等',
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
            description: '图片尺寸，默认 1024x1024',
          },
          quality: {
            type: 'string',
            enum: ['standard', 'hd'],
            description: '图片质量，默认 standard',
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
        const result = await generateImage(context.imageModelConfig, {
          prompt: args.prompt as string,
          size: (args.size as string) || undefined,
          quality: (args.quality as string) || undefined,
          n: (args.n as number) || undefined,
        });
        if (result.urls.length === 0) {
          throw new Error('生图 API 未返回图片 URL');
        }
        return JSON.stringify({
          urls: result.urls,
          revisedPrompt: result.revisedPrompt,
          hint: '请在回复中用 markdown 格式展示图片，例如：![描述](URL)。同时提供图片链接供用户复制下载。',
        });
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
