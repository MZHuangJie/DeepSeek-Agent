import { streamChat, ModelConfig } from './client';
import type { Provider, StreamCallbacks } from './providers/types';
import { selectProvider } from './providers';
import type { ToolContext } from './tools/index';
import { getSubAgentTools, getToolSchemas } from './tools';
import { BrowserWindow } from 'electron';
import { errorLog, log } from '../logger';
import { getSetting } from '../db/settings';
import { resolveImageModelConfig } from '../services/image-model-config';
import { buildVisionToolContext } from './vision-config';

export type SubAgentType = 'explore' | 'analyze' | 'implement' | 'review';

export interface SubAgentTask {
  id: string;
  type: SubAgentType;
  description: string;
  targetPath: string;
  projectDir: string;
  waveIndex?: number;
}

export interface SubAgentResult {
  taskId: string;
  success: boolean;
  summary: string;
  filesProcessed: string[];
  findings: string[];
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;
}

export function formatSubAgentResultsForTool(
  items: Array<{ targetPath: string }>,
  results: SubAgentResult[],
): string {
  const body = results.map((r, idx) => {
    const path = items[idx]?.targetPath ?? r.taskId;
    const lines = [
      `${r.success ? '✓ 成功' : '✗ 失败'} ${path}`,
      `处理文件: ${r.filesProcessed.length}，Token: ${r.tokenUsage.total}`,
    ];
    if (r.error) lines.push(`失败原因: ${r.error}`);
    if (r.summary?.trim()) lines.push('', r.summary.trim());
    else if (!r.success) lines.push('', '(子代理未产生有效输出)');
    return lines.join('\n');
  }).join('\n\n---\n\n');

  const failed = results.filter(r => !r.success).length;
  if (failed > 0) {
    return `${body}\n\n【系统提示】${failed}/${results.length} 个子代理失败。你必须根据以上结果立即向用户说明失败原因、已成功部分与后续计划，不要停止回复，也不要再次调用 spawn_sub_agent。`;
  }
  return `${body}\n\n【系统提示】子代理已全部完成。请汇总以上发现并向用户给出完整结论。`;
}

export class SubAgentManager {
  private activeSubAgents = new Map<string, AbortController>();
  private spawnWave = 0;

  constructor(private win: BrowserWindow) {}

  /** 每次主 Agent 调用 spawn 工具时递增，用于 UI 区分批次 */
  beginSpawnWave(): number {
    this.spawnWave += 1;
    this.win.webContents.send('agent:stream-chunk', {
      type: 'sub-agent-wave-start',
      waveIndex: this.spawnWave,
    });
    return this.spawnWave;
  }

  async spawnSubAgent(
    task: SubAgentTask,
    apiKey: string,
    modelConfig: ModelConfig,
    contextMax: number = 100000,
    parentSignal?: AbortSignal,
  ): Promise<SubAgentResult> {
    const abortController = new AbortController();
    this.activeSubAgents.set(task.id, abortController);

    if (parentSignal) {
      if (parentSignal.aborted) abortController.abort();
      else parentSignal.addEventListener('abort', () => abortController.abort(), { once: true });
    }

    try {
      this.win.webContents.send('agent:stream-chunk', {
        type: 'sub-agent-start',
        taskId: task.id,
        subAgentType: task.type,
        description: task.description,
        targetPath: task.targetPath,
        waveIndex: task.waveIndex ?? this.spawnWave,
      });

      const mustUseTools = `【重要】你必须使用工具来实际执行任务。不要只用文字描述，必须调用工具（list_files、read_file 等）去真正读取和操作文件。\n\n${task.description}`;
      const subMessages = [
        { role: 'system', content: this.buildSubAgentPrompt(task.type, task.projectDir) },
        { role: 'user', content: mustUseTools },
      ];

      const tools = getSubAgentTools(task.projectDir);
      const toolSchemas = getToolSchemas(tools);

      const provider = selectProvider(modelConfig.model, modelConfig.baseUrl);

      const result = await this.runSubAgentLoop(
        task,
        subMessages,
        tools,
        toolSchemas,
        apiKey,
        modelConfig,
        contextMax,
        abortController.signal,
        provider,
        task.projectDir,
      );

      this.win.webContents.send('agent:stream-chunk', {
        type: 'sub-agent-complete',
        taskId: task.id,
        success: result.success,
        summary: result.summary,
        error: result.error,
        filesProcessed: result.filesProcessed.length,
        tokenUsage: result.tokenUsage,
      });

      return result;
    } catch (err: any) {
      const errorResult: SubAgentResult = {
        taskId: task.id,
        success: false,
        summary: '',
        filesProcessed: [],
        findings: [],
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        error: err.message,
      };

      this.win.webContents.send('agent:stream-chunk', {
        type: 'sub-agent-error',
        taskId: task.id,
        error: err.message,
      });

      return errorResult;
    } finally {
      this.activeSubAgents.delete(task.id);
    }
  }

  async spawnMultipleSubAgents(
    tasks: SubAgentTask[],
    apiKey: string,
    modelConfig: ModelConfig,
    contextMax: number = 100000,
    parentSignal?: AbortSignal,
  ): Promise<SubAgentResult[]> {
    if (tasks.length === 0) return [];

    const waveIndex = this.beginSpawnWave();
    const tasksWithWave = tasks.map(t => ({ ...t, waveIndex }));

    const results: SubAgentResult[] = new Array(tasksWithWave.length);
    let cursor = 0;
    const concurrency = 2;

    const runNext = async (): Promise<void> => {
      const index = cursor++;
      if (index >= tasksWithWave.length) return;
      if (index > 0) await new Promise(r => setTimeout(r, 400));
      results[index] = await this.spawnSubAgent(
        tasksWithWave[index],
        apiKey,
        modelConfig,
        contextMax,
        parentSignal,
      );
      await runNext();
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, tasks.length) }, () => runNext()),
    );
    return results;
  }

  cancelSubAgent(taskId: string): void {
    const controller = this.activeSubAgents.get(taskId);
    if (controller) {
      controller.abort();
      this.activeSubAgents.delete(taskId);
    }
  }

  cancelAllSubAgents(): void {
    for (const [taskId, controller] of this.activeSubAgents) {
      controller.abort();
    }
    this.activeSubAgents.clear();
  }

  private buildSubAgentPrompt(type: SubAgentType, projectDir?: string): string {
    const dirHint = projectDir
      ? `\n## 工作目录\n项目根目录: \`${projectDir}\`\n所有工具调用中的路径参数必须使用绝对路径（基于上述项目根目录拼接）。`
      : '';
    const basePrompt = `你是一个专门的子代理，负责处理特定的任务。你的工作是高效、彻底地完成分配的任务，然后给出清晰的总结。
${dirHint}
## 工作原则
1. 专注于分配的任务范围，不要偏离
2. 使用工具高效地收集信息
3. 每次工具调用都要有明确的目的
4. 完成后给出结构化的总结`;

    const typeSpecificPrompts: Record<SubAgentType, string> = {
      explore: `
## 任务类型：探索（Explore）

你的任务是探索指定目录下的所有文件，了解代码结构和组织方式。

### 工作流程
1. 使用 list_files 列出目录内容
2. 使用 read_file 读取所有源代码文件
3. 记录每个文件的用途和关键功能
4. 识别文件之间的依赖关系

### 输出要求
给出以下结构化总结：
- **文件清单**：列出所有处理的文件
- **目录结构**：描述目录的组织方式
- **关键发现**：重要的模式、约定或问题`,

      analyze: `
## 任务类型：分析（Analyze）

你的任务是深入分析指定的代码模块，理解其实现细节和设计决策。

### 工作流程
1. 读取目标文件和相关依赖
2. 分析代码逻辑、数据流和控制流
3. 识别设计模式和架构决策
4. 评估代码质量和潜在问题

### 输出要求
给出以下结构化总结：
- **功能描述**：模块的核心功能
- **实现细节**：关键算法和数据结构
- **依赖关系**：与其他模块的交互
- **质量评估**：代码质量、可维护性、潜在问题`,

      implement: `
## 任务类型：实现（Implement）

你的任务是实现指定的功能或修复指定的问题。

### 工作流程
1. 理解需求和现有代码
2. 设计实现方案
3. 使用 write_file 或 edit_file 实现代码
4. 验证实现的正确性

### 输出要求
给出以下结构化总结：
- **实现内容**：完成了什么功能
- **修改文件**：列出所有修改的文件
- **关键决策**：重要的设计决策和理由
- **测试建议**：如何验证实现`,

      review: `
## 任务类型：审查（Review）

你的任务是对指定代码进行深度审查，发现 Bug、安全漏洞、性能问题和可维护性问题。

### 第一步：了解变更范围
1. 使用 bash 运行 \`git diff\` 查看未提交的改动（如果有）
2. 使用 read_file 读取所有目标文件（不要跳过任何文件）
3. 对于引用了 CSS Module 的 TSX 文件，必须同时读取对应的 .module.css 文件，检查 className 是否都有对应定义

### 第二步：按检查清单逐项审查

#### 🔴 CRITICAL — 必须发现，否则直接判定审查失败
- [ ] **className 与 CSS 定义一致**：TSX 中每个 \`styles.xxx\` / \`shared.xxx\` 是否在对应 CSS 文件中有定义？任何缺失的类名都是 BUG
- [ ] **import 有效性**：所有 import 的模块/函数/类型是否真实存在？
- [ ] **硬编码密钥**：是否有 API key、token、password 写在代码里？
- [ ] **空值崩溃**：\`.find()\` / \`[0]\` / \`pop()\` 等操作前是否判空？
- [ ] **async 遗漏**：调用 async 函数是否都有 await（或 .then / .catch）？

#### 🟠 HIGH — 功能正确性与安全
- [ ] **XSS / 注入**：\`innerHTML\`、\`dangerouslySetInnerHTML\` 是否有净化？
- [ ] **错误吞没**：try-catch 是否为空？catch 里是否只 log 不处理？
- [ ] **状态不一致**：setState / store 更新是否可能产生中间非法状态？
- [ ] **竞态条件**：多个异步操作的结果到达顺序是否可能出错？
- [ ] **类型安全**：是否有 \`any\` 绕过类型检查？是否用 \`as\` 做了不安全断言？

#### 🟡 MEDIUM — 代码质量
- [ ] **函数过长**：是否有超过 50 行的函数？
- [ ] **深层嵌套**：是否有超过 4 层的 if/for/try 嵌套？
- [ ] **重复代码**：是否有复制粘贴的逻辑块？
- [ ] **命名混乱**：变量/函数名是否自解释？
- [ ] **不可变**：是否直接修改了对象/数组参数而非创建新副本？

#### 🟢 LOW — 可维护性
- [ ] **console.log**：是否有遗留的调试日志？
- [ ] **注释质量**：注释是否解释了 WHY 而非 WHAT？

### 第三步：输出格式
按以下结构输出，每一项必须包含**文件名:行号**和**具体修复建议**：

- **审查范围**：列出了哪些文件（含 CSS）
- **关键问题** (CRITICAL)：每个问题一行 \`- 文件:行号 — 问题描述 — 修复: 具体代码\`
- **重要问题** (HIGH)：同上格式
- **改进建议** (MEDIUM)：同上格式
- **小建议** (LOW)：同上格式
- **总体评价**：1-2 句总结

⚠️ 如果你只输出笼统评价而没有逐文件逐行的具体问题，审查就是无效的。`,
    };

    return basePrompt + '\n' + typeSpecificPrompts[type];
  }

  private extractFindings(summary: string): string[] {
    if (!summary) return [];
    const findings: string[] = [];
    // 抓取 markdown 列表项（- xxx 或 * xxx），去掉前缀加粗符号
    const lineRe = /^[\s]*[-*][\s]+(.+?)[\s]*$/gm;
    let match: RegExpExecArray | null;
    while ((match = lineRe.exec(summary)) !== null) {
      const item = match[1].replace(/^\*\*(.+?)\*\*[:：]?\s*/, '$1: ').trim();
      if (item.length > 0 && item.length < 300) {
        findings.push(item);
      }
    }
    return findings.slice(0, 30); // 上限 30 条，避免噪声
  }

  private buildResult(
    task: SubAgentTask,
    success: boolean,
    messages: any[],
    filesProcessed: Set<string>,
    totalPrompt: number,
    totalCompletion: number,
    totalTokens: number,
    error?: string
  ): SubAgentResult {
    const lastAssistantMessage = messages
      .filter((m) => m.role === 'assistant' && m.content)
      .pop();
    const summary = lastAssistantMessage?.content || (success ? '子代理未给出总结' : '');
    const findings = this.extractFindings(summary);

    return {
      taskId: task.id,
      success,
      summary,
      filesProcessed: Array.from(filesProcessed),
      findings,
      tokenUsage: {
        prompt: totalPrompt,
        completion: totalCompletion,
        total: totalTokens,
      },
      error,
    };
  }

  /** DeepSeek 思考模式要求把 reasoning_content 原样带回后续请求 */
  private pushAssistantMessage(
    messages: any[],
    result: { content?: string; thinking?: string },
    toolCalls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>,
  ) {
    const msg: Record<string, unknown> = {
      role: 'assistant',
      content: result.content || '',
    };
    if (result.thinking) msg.reasoning_content = result.thinking;
    if (toolCalls?.length) msg.tool_calls = toolCalls;
    messages.push(msg);
  }

  private async runSubAgentLoop(
    task: SubAgentTask,
    messages: any[],
    tools: any[],
    toolSchemas: any[],
    apiKey: string,
    modelConfig: ModelConfig,
    contextMax: number,
    signal: AbortSignal,
    provider: Provider,
    projectDir: string,
  ): Promise<SubAgentResult> {
    const maxTurns = 40;
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTokens = 0;
    const filesProcessed = new Set<string>();

    for (let turn = 0; turn < maxTurns; turn++) {
      if (signal.aborted) break;

      const callbacks: StreamCallbacks = {
        onContent: (text: string) => {
          this.win.webContents.send('agent:stream-chunk', {
            type: 'sub-agent-chunk',
            taskId: task.id,
            chunkType: 'content',
            text,
          });
        },
        onThinking: (text: string) => {
          this.win.webContents.send('agent:stream-chunk', {
            type: 'sub-agent-chunk',
            taskId: task.id,
            chunkType: 'thinking',
            text,
          });
        },
      };

      let result;
      try {
        result = await streamChat(
          apiKey,
          messages,
          toolSchemas,
          modelConfig,
          callbacks,
          signal,
          provider,
        );
      } catch (err: any) {
        if (signal.aborted) break;
        const errMsg = err?.message || String(err);
        errorLog('sub-agent', 'stream-error', { taskId: task.id, error: errMsg });
        // 失败时返回当前已累积的部分结果，而不是丢弃所有状态
        return this.buildResult(
          task,
          false,
          messages,
          filesProcessed,
          totalPrompt,
          totalCompletion,
          totalTokens,
          errMsg
        );
      }

      if (signal.aborted) break;

      if (result.usage) {
        totalPrompt += result.usage.prompt_tokens;
        totalCompletion += result.usage.completion_tokens;
        totalTokens += result.usage.total_tokens;

        this.win.webContents.send('agent:stream-chunk', {
          type: 'sub-agent-usage',
          taskId: task.id,
          prompt: totalPrompt,
          completion: totalCompletion,
          total: totalTokens,
        });

        // 子代理的上下文压缩阈值更激进（70%）
        if (totalPrompt > contextMax * 0.7) {
          const toolMessageIndices: number[] = [];
          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'tool') {
              toolMessageIndices.push(i);
            }
          }

          const compressCount = Math.floor(toolMessageIndices.length * 0.6);
          for (let i = 0; i < compressCount; i++) {
            const idx = toolMessageIndices[i];
            const originalContent = messages[idx].content;
            if (typeof originalContent === 'string' && originalContent.length > 150) {
              messages[idx].content =
                originalContent.slice(0, 75) +
                '\n...[已压缩]...\n' +
                originalContent.slice(-75);
            }
          }
        }
      }

      if (result.toolCalls.length === 0) {
        // 第一轮模型就拒绝使用工具 — 强制推动
        if (turn === 0 && (!result.content || result.content.length < 50)) {
          messages.push({
            role: 'user',
            content: '你必须实际使用工具！请立即调用 list_files 查看目录，然后用 read_file 读取文件内容。不要只回复文字。',
          });
          continue;
        }

        // 检测 content 中是否包含未识别的伪工具调用格式（如 ::list_files::、<tool_call> 等）
        const pseudoCallPattern = /::\w+::|<tool_call>|<function_call|<invoke/i;
        if (turn < 2 && result.content && pseudoCallPattern.test(result.content)) {
          log('warn', 'sub-agent', '检测到未解析的伪工具调用格式，尝试重新引导', {
            taskId: task.id,
            preview: result.content.slice(0, 300),
          });
          messages.push({
            role: 'user',
            content: '你的工具调用格式不正确！你必须使用标准的 OpenAI function call 格式调用工具。直接发起函数调用即可，不要用 ::name::、<tool_call> 等自定义格式包裹。请立即重试。',
          });
          continue;
        }

        // 子代理完成任务
        if (result.content || result.thinking) {
          this.pushAssistantMessage(messages, result);
        }
        break;
      }

      // 撞 max_tokens 截断时，工具调用可能不完整，停下来交给后置总结流程
      if (result.finishReason === 'length') {
        if (result.content || result.thinking) {
          this.pushAssistantMessage(messages, result);
        }
        break;
      }

      // 处理工具调用
      for (const tc of result.toolCalls) {
        this.win.webContents.send('agent:stream-chunk', {
          type: 'sub-agent-tool-call',
          taskId: task.id,
          name: tc.name,
          args: tc.arguments,
        });

        // 跟踪读取的文件
        if (tc.name === 'read_file') {
          try {
            const args = JSON.parse(tc.arguments || '{}');
            if (args.path) filesProcessed.add(args.path);
          } catch {}
        }
      }

      const assistantToolCalls = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
      this.pushAssistantMessage(messages, result, assistantToolCalls);

      for (const tc of result.toolCalls) {
        const tool = tools.find((t) => t.name === tc.name);
        let toolResult = '';
        if (!tool) {
          toolResult = `未知工具: ${tc.name}`;
        } else {
          try {
            const args = JSON.parse(tc.arguments || '{}');
            const imageModelRaw = getSetting('imageModel');
            const imageModelConfig = resolveImageModelConfig(imageModelRaw, apiKey);

            const toolCtx: ToolContext = {
              apiKey,
              modelConfig,
              contextMax,
              subAgentManager: undefined as any, // 子代理不能再派子代理
              projectDir,
              imageModelConfig,
              visionModelConfig: buildVisionToolContext(modelConfig, apiKey, false),
            };
            toolResult = await tool.execute(args, toolCtx);
          } catch (err: any) {
            errorLog('sub-agent', 'tool-exec-error', { taskId: task.id, tool: tc.name, error: err.message });
            toolResult = err.message;
          }
        }
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
    }

    // 检查是否已有最终总结（最后一条 assistant 消息有 content 且没有 tool_calls）
    const lastMsg = messages[messages.length - 1];
    const hasFinalSummary =
      lastMsg?.role === 'assistant' &&
      typeof lastMsg.content === 'string' &&
      lastMsg.content.trim().length > 0 &&
      !lastMsg.tool_calls;

    // 如果没有最终总结且未被中止，追加一轮强制总结请求（不带工具）
    if (!hasFinalSummary && !signal.aborted) {
      messages.push({
        role: 'user',
        content: `请基于已读取的内容立刻给出最终总结。不要再调用任何工具。按以下结构输出：
- **任务范围**：处理了哪些文件/目录
- **主要发现**：关键模块、设计、问题（用 markdown 列表，每条单独一行）
- **结论**：简短整体评估`,
      });

      const summaryCallbacks: StreamCallbacks = {
        onContent: (text: string) => {
          this.win.webContents.send('agent:stream-chunk', {
            type: 'sub-agent-chunk',
            taskId: task.id,
            chunkType: 'content',
            text,
          });
        },
        onThinking: (text: string) => {
          this.win.webContents.send('agent:stream-chunk', {
            type: 'sub-agent-chunk',
            taskId: task.id,
            chunkType: 'thinking',
            text,
          });
        },
      };

      try {
        const summaryResult = await streamChat(
          apiKey,
          messages,
          [],
          modelConfig,
          summaryCallbacks,
          signal,
          provider,
        );

        if (summaryResult.usage) {
          totalPrompt += summaryResult.usage.prompt_tokens;
          totalCompletion += summaryResult.usage.completion_tokens;
          totalTokens += summaryResult.usage.total_tokens;
        }

        const finalText = summaryResult.content || summaryResult.thinking || '';
        if (finalText || summaryResult.thinking) {
          this.pushAssistantMessage(messages, summaryResult);
        }
      } catch {
        // 总结请求失败时，沿用已有状态返回
      }
    }

    // 正常路径：循环结束（自然完成、达到 maxTurns 或被中止）
    return this.buildResult(
      task,
      !signal.aborted,
      messages,
      filesProcessed,
      totalPrompt,
      totalCompletion,
      totalTokens,
      signal.aborted ? '子代理已被取消' : undefined
    );
  }
}
