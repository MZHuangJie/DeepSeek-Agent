import { ipcMain, BrowserWindow } from 'electron';
import { streamChat } from '../agent/client';
import { buildCachePrefix, buildMessages } from '../agent/cache';
import { getAllTools, getToolSchemas, ToolDef } from '../agent/tools';
import { buildProjectContext } from '../agent/context';
import { SubAgentManager } from '../agent/sub-agent';

const SYSTEM_PROMPT = `你是一个编程助手 DeepSeek Agent。你可以：
- 读取、写入和编辑文件
- 使用 grep 搜索代码
- 执行终端命令
- 列出目录内容

## 项目文件读取策略（重要）

当用户需要你查看/分析/审计项目代码时，必须按以下步骤**逐层、全量**读取，不要遗漏：

### 第1步：全貌扫描
- 先用 list_files 查看项目根目录
- 再用 list_files 递归查看 src 等核心目录的子目录
- 目标：拿到完整的目录树，了解项目由哪些模块组成

### 第2步：配置文件（必读）
- package.json / tsconfig.json / .gitignore / README.md
- vite.*.config.ts / docker-compose.yml 等
- 目标：理解项目技术栈、依赖、构建方式

### 第3步：入口文件（必读）
- 主进程入口（如 main/index.ts）
- 预加载脚本（如 preload/index.ts）
- 渲染入口（如 renderer/index.tsx, App.tsx）
- 目标：理解应用启动流程和架构分层

### 第4步：核心模块（逐个目录全读）
将 src 下的核心目录逐个读取，例如：
- agent/ 目录下的所有文件
- db/ 目录下的所有文件
- ipc/ 目录下的所有文件
- security/ 目录下的所有文件
每个目录下的文件要全部读完，不要只看其中一两个

### 第5步：状态管理 & UI 组件（全读）
- stores/ 目录下的所有文件
- components/ 目录下的所有组件文件
- 不要跳过任何一个文件

### 第6步：构建配置 & 脚本
- scripts/ 目录下的文件
- 其他配置文件

## 关键原则（必须遵守，违反会导致错误）

1. **每回合至少读 3 个文件**：不要一次只读 1 个文件。每个回合必须调用多次 read_file。
2. **按目录批量聚合**：同一目录下的所有文件，在一次回复中全部读完。不要读到一半跳到其他目录。
3. **禁止提前停止**：在所有源码目录（src/ 下所有子目录）都读完之后，才能给出最终分析。即使你觉得"已经了解了"，也必须继续读剩下的文件。
4. **停止前必须给完整分析**：读完全部文件后，给出结构化的分析：架构分层 → 各模块功能 → 关键发现 → 建议。
5. **如果你现在就想停止，不要停**：继续读取未读的目录。检查 components/、scripts/、vite config 等是否遗漏。

## 子代理（Sub-Agent）使用策略

你拥有两个特殊工具，可以派出**子代理**并行处理大型任务。每个子代理拥有**独立的上下文窗口**，可以同时探索不同模块，互不干扰。

### 何时使用子代理（强烈推荐场景）

1. **大型项目探索（文件数 > 30）**：用户要求"查看项目"、"分析代码库"、"审计代码"时，应优先使用 \`auto_decompose_task\` 让系统自动拆分
2. **多模块并行分析**：当需要同时分析 src/main、src/renderer、src/preload 等多个独立模块时，使用 \`spawn_sub_agent\` 并提供 \`parallel_tasks\` 数组
3. **深入审查特定目录**：单个目录文件较多（>10）且需要详细分析时，派一个子代理专门处理

### 何时**不**使用子代理

- 用户只问单个文件或小范围问题
- 简单的代码修改、调试任务
- 项目规模较小（文件数 < 20）

### 如何使用

**方式 A：自动拆分（推荐用于探索性查询）**

\`\`\`json
{
  "name": "auto_decompose_task",
  "arguments": { "user_query": "查看整个项目代码" }
}
\`\`\`

系统会自动扫描项目，按目录拆分子任务并并行执行。

**方式 B：手动指定并行任务**

\`\`\`json
{
  "name": "spawn_sub_agent",
  "arguments": {
    "task_type": "explore",
    "description": "整体协调任务",
    "target_path": ".",
    "parallel_tasks": [
      { "task_type": "explore", "description": "探索主进程", "target_path": "src/main" },
      { "task_type": "explore", "description": "探索渲染进程", "target_path": "src/renderer" },
      { "task_type": "explore", "description": "探索预加载脚本", "target_path": "src/preload" }
    ]
  }
}
\`\`\`

### 重要：调用子代理前必须告知用户

在调用 \`spawn_sub_agent\` 或 \`auto_decompose_task\` **之前**，**先输出一段说明文字**告诉用户：
- 你打算派出几个子代理
- 每个子代理负责哪个目录或任务
- 为什么选择子代理方式（例如"项目较大，单代理处理上下文不够"）

示例：
> 项目包含约 45 个源文件，分布在 src/main、src/renderer、src/preload 三个主要模块。我将派出 3 个子代理并行探索这些目录，每个子代理拥有独立的上下文窗口，可以同时深入分析而不会相互干扰。

这样用户能在右侧"Agent 观测"面板看到子代理状态，并理解你的工作方式。`;


let activeAbort: AbortController | null = null;
let activeSubAgentManager: SubAgentManager | null = null;

export function setupAgentHandlers() {
  ipcMain.handle('agent:send', async (event, payload: {
    messages: Array<{ role: string; content: string }>;
    apiKey: string;
    projectDir: string;
    newMessage: string;
    model?: string;
    baseUrl?: string;
    contextMax?: number;
    commandPrompt?: string;
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');

    const abortController = new AbortController();
    activeAbort = abortController;

    const tools = getAllTools(payload.projectDir);
    const projectContext = buildProjectContext(payload.projectDir);
    const subAgentManager = new SubAgentManager(win);
    activeSubAgentManager = subAgentManager;

    // 如果有命令，将命令指令追加到 system prompt
    const fullSystemPrompt = payload.commandPrompt
      ? `${SYSTEM_PROMPT}\n\n## 当前命令模式\n${payload.commandPrompt}`
      : SYSTEM_PROMPT;

    const prefix = buildCachePrefix(fullSystemPrompt, projectContext);
    let messages: any[] = buildMessages(prefix, payload.messages, payload.newMessage);

    const modelConfig = {
      model: payload.model || 'deepseek-chat',
      baseUrl: payload.baseUrl || 'https://api.deepseek.com',
    };
    const toolSchemas = getToolSchemas(tools);

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTokens = 0;

    // 动态计算最大轮次：根据项目文件数量
    const glob = require('glob');
    const allSourceFiles = glob.sync('**/*.{ts,tsx,js,jsx,json}', {
      cwd: payload.projectDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      absolute: false,
    });
    const estimatedTurnsNeeded = Math.ceil(allSourceFiles.length / 3); // 假设每轮读 3 个文件
    const maxTurns = Math.max(50, Math.min(estimatedTurnsNeeded, 200)); // 最少 50 轮，最多 200 轮

    for (let turn = 0; turn < maxTurns; turn++) {
      if (abortController.signal.aborted) break;

      let result;
      try {
        result = await streamChat(
          payload.apiKey,
          messages,
          toolSchemas,
          modelConfig,
          {
            onContent: (text) => {
              win.webContents.send('agent:stream-chunk', { type: 'content', text });
            },
            onThinking: (text) => {
              win.webContents.send('agent:stream-chunk', { type: 'thinking', text });
            },
          },
          abortController.signal
        );
      } catch (err: any) {
        if (abortController.signal.aborted) break;
        throw err;
      }

      if (abortController.signal.aborted) break;

      if (result.usage) {
        totalPrompt += result.usage.prompt_tokens;
        totalCompletion += result.usage.completion_tokens;
        totalTokens += result.usage.total_tokens;
        win.webContents.send('agent:stream-chunk', {
          type: 'usage',
          prompt: totalPrompt,
          completion: totalCompletion,
          total: totalTokens,
          contextMax: payload.contextMax || 100000,
        });

        // 上下文压缩：当接近上下文限制时（80%），压缩早期的工具调用结果
        const contextMax = payload.contextMax || 100000;
        if (totalPrompt > contextMax * 0.8) {
          // 找到所有 tool 角色的消息
          const toolMessageIndices: number[] = [];
          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'tool') {
              toolMessageIndices.push(i);
            }
          }

          // 压缩前 50% 的工具调用结果
          const compressCount = Math.floor(toolMessageIndices.length * 0.5);
          for (let i = 0; i < compressCount; i++) {
            const idx = toolMessageIndices[i];
            const originalContent = messages[idx].content;
            if (typeof originalContent === 'string' && originalContent.length > 200) {
              // 只保留前 100 字符 + 后 100 字符
              messages[idx].content =
                originalContent.slice(0, 100) +
                '\n...[已压缩]...\n' +
                originalContent.slice(-100);
            }
          }

          win.webContents.send('agent:stream-chunk', {
            type: 'content',
            text: `\n[系统提示：已压缩 ${compressCount} 个早期工具调用结果以节省上下文]\n`,
          });
        }
      }

      if (result.toolCalls.length === 0) {
        // 模型给出最终回复，推入 messages 以保存对话历史
        if (result.content || result.thinking) {
          messages.push({
            role: 'assistant',
            content: result.content || '',
          });
        }

        // 统计工具调用情况
        let readFileCount = 0;
        let listCount = 0;
        let totalToolCalls = 0;
        const readFiles = new Set<string>(); // 跟踪读了哪些文件
        const listedDirs = new Set<string>(); // 跟踪列出过的目录

        for (const m of messages) {
          if (m.role === 'assistant' && m.tool_calls) {
            for (const tc of m.tool_calls) {
              totalToolCalls++;
              if (tc.function?.name === 'read_file') {
                readFileCount++;
                try {
                  const args = JSON.parse(tc.function?.arguments || '{}');
                  if (args.path) readFiles.add(args.path);
                } catch {}
              }
              if (tc.function?.name === 'list_files') {
                listCount++;
                try {
                  const args = JSON.parse(tc.function?.arguments || '{}');
                  if (args.path) listedDirs.add(args.path);
                } catch {}
              }
            }
          }
        }

        // 如果模型在本次对话中使用了任何工具，判定为「探索模式」
        const isExploreMode = totalToolCalls > 0;

        if (isExploreMode) {
          // 使用 glob 扫描实际的项目文件
          const glob = require('glob');
          const path = require('path');

          // 扫描所有源文件
          const allSourceFiles = glob.sync('**/*.{ts,tsx,js,jsx,json}', {
            cwd: payload.projectDir,
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
            absolute: false,
          });

          // 找出未读的文件
          const unreadFiles = (allSourceFiles as string[]).filter((f: string) => !readFiles.has(f) && !readFiles.has(path.join(payload.projectDir, f)));
          const totalFiles = allSourceFiles.length;
          const readPercentage = Math.round((readFileCount / totalFiles) * 100);

          // 如果还有大量未读文件，强制继续
          if (unreadFiles.length > 0 && readPercentage < 80) {
            // 按目录分组未读文件
            const unreadByDir: Record<string, string[]> = {};
            for (const f of unreadFiles) {
              const dir = path.dirname(f);
              if (!unreadByDir[dir]) unreadByDir[dir] = [];
              unreadByDir[dir].push(path.basename(f));
            }

            // 找出最重要的未读目录（src/ 下的核心目录）
            const criticalDirs = Object.keys(unreadByDir)
              .filter(d => d.startsWith('src/'))
              .sort((a, b) => unreadByDir[b].length - unreadByDir[a].length)
              .slice(0, 3);

            let nudgeMsg = `**进度检查**：你已读取 ${readFileCount}/${totalFiles} 个文件（${readPercentage}%），还有 ${unreadFiles.length} 个文件未读。当前轮次：${turn + 1}/${maxTurns}\n\n`;

            if (criticalDirs.length > 0) {
              nudgeMsg += `**未读的关键目录**：\n`;
              for (const dir of criticalDirs) {
                const files = unreadByDir[dir].slice(0, 5);
                nudgeMsg += `- ${dir}/: ${files.join(', ')}${unreadByDir[dir].length > 5 ? ` 等 ${unreadByDir[dir].length} 个文件` : ''}\n`;
              }
              nudgeMsg += `\n请继续读取这些目录下的文件。每个回合批量读取 3-5 个文件，直到覆盖所有核心源码。`;
            } else {
              // 列出前10个未读文件
              const sampleUnread = unreadFiles.slice(0, 10);
              nudgeMsg += `**部分未读文件**：\n${sampleUnread.map((f: string) => `- ${f}`).join('\n')}\n`;
              nudgeMsg += `\n请继续读取这些文件。`;
            }

            messages.push({ role: 'user', content: nudgeMsg });
            continue;
          }

          // 读取率达到 80% 以上，允许停止
          if (readPercentage >= 80) {
            // 但如果模型没有给出任何分析内容，要求补充
            if (!result.content || result.content.length < 100) {
              messages.push({
                role: 'user',
                content: `你已读取了 ${readPercentage}% 的文件（${readFileCount}/${totalFiles}），但没有给出分析。请基于你读取的内容，给出完整的项目分析：\n1. 项目架构和技术栈\n2. 各模块功能说明\n3. 发现的问题或建议\n4. 代码质量评估`,
              });
              continue;
            }
          }

          // 如果达到最大轮次但还没读完，给出警告
          if (turn >= maxTurns - 1 && readPercentage < 80) {
            win.webContents.send('agent:stream-chunk', {
              type: 'content',
              text: `\n\n⚠️ **已达到最大轮次限制（${maxTurns}轮）**\n当前已读取 ${readPercentage}% 的文件（${readFileCount}/${totalFiles}）。\n项目文件较多，建议按模块分批查看，或使用更具体的查询。\n`,
            });
          }
        }

        // 纯对话模式（没有用任何工具），直接放行
        break;
      }

      for (const tc of result.toolCalls) {
        win.webContents.send('agent:stream-chunk', {
          type: 'tool-call',
          name: tc.name,
          args: tc.arguments,
        });
      }

      const assistantToolCalls = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
      messages.push({
        role: 'assistant',
        content: result.content || '',
        tool_calls: assistantToolCalls,
      });

      for (const tc of result.toolCalls) {
        const tool = tools.find(t => t.name === tc.name);
        let toolResult = '';
        let status: 'success' | 'error' = 'success';
        if (!tool) {
          toolResult = `未知工具: ${tc.name}`;
          status = 'error';
        } else {
          try {
            const args = JSON.parse(tc.arguments || '{}');
            const toolContext = {
              apiKey: payload.apiKey,
              modelConfig: {
                model: modelConfig.model,
                baseUrl: modelConfig.baseUrl,
              },
              contextMax: payload.contextMax || 100000,
              subAgentManager,
            };
            toolResult = await tool.execute(args, toolContext);
          } catch (err: any) {
            toolResult = err.message;
            status = 'error';
          }
        }
        win.webContents.send('agent:stream-chunk', {
          type: 'tool-result',
          name: tc.name,
          result: toolResult,
          status,
        });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
    }

    activeAbort = null;
    activeSubAgentManager = null;
    win.webContents.send('agent:stream-chunk', { type: 'done' });
    return { success: true };
  });

  ipcMain.handle('agent:cancel', async () => {
    activeAbort?.abort();
    activeAbort = null;
    activeSubAgentManager?.cancelAllSubAgents();
    activeSubAgentManager = null;
    return { success: true };
  });
}
