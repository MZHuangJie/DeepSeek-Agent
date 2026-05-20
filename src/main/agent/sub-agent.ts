import { streamChat, ModelConfig, StreamCallbacks } from './client';
import { getAllTools, getToolSchemas } from './tools';
import { BrowserWindow } from 'electron';

export type SubAgentType = 'explore' | 'analyze' | 'implement' | 'review';

export interface SubAgentTask {
  id: string;
  type: SubAgentType;
  description: string;
  targetPath: string;
  projectDir: string;
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

export class SubAgentManager {
  private activeSubAgents = new Map<string, AbortController>();

  constructor(private win: BrowserWindow) {}

  async spawnSubAgent(
    task: SubAgentTask,
    apiKey: string,
    modelConfig: ModelConfig,
    contextMax: number = 100000
  ): Promise<SubAgentResult> {
    const abortController = new AbortController();
    this.activeSubAgents.set(task.id, abortController);

    try {
      this.win.webContents.send('agent:stream-chunk', {
        type: 'sub-agent-start',
        taskId: task.id,
        subAgentType: task.type,
        description: task.description,
        targetPath: task.targetPath,
      });

      const subMessages = [
        { role: 'system', content: this.buildSubAgentPrompt(task.type) },
        { role: 'user', content: task.description },
      ];

      const tools = getAllTools(task.projectDir);
      const toolSchemas = getToolSchemas(tools);

      const result = await this.runSubAgentLoop(
        task,
        subMessages,
        tools,
        toolSchemas,
        apiKey,
        modelConfig,
        contextMax,
        abortController.signal
      );

      this.win.webContents.send('agent:stream-chunk', {
        type: 'sub-agent-complete',
        taskId: task.id,
        success: result.success,
        summary: result.summary,
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
    contextMax: number = 100000
  ): Promise<SubAgentResult[]> {
    const promises = tasks.map((task) =>
      this.spawnSubAgent(task, apiKey, modelConfig, contextMax)
    );
    return Promise.all(promises);
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

  private buildSubAgentPrompt(type: SubAgentType): string {
    const basePrompt = `你是一个专门的子代理，负责处理特定的任务。你的工作是高效、彻底地完成分配的任务，然后给出清晰的总结。

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

你的任务是审查指定的代码，发现问题并提出改进建议。

### 工作流程
1. 读取目标代码
2. 检查代码质量、安全性、性能
3. 识别潜在的 bug 和改进点
4. 提出具体的改进建议

### 输出要求
给出以下结构化总结：
- **审查范围**：审查了哪些文件
- **发现问题**：按严重程度分类的问题列表
- **改进建议**：具体的改进方案
- **优点**：代码中做得好的地方`,
    };

    return basePrompt + '\n' + typeSpecificPrompts[type];
  }

  private async runSubAgentLoop(
    task: SubAgentTask,
    messages: any[],
    tools: any[],
    toolSchemas: any[],
    apiKey: string,
    modelConfig: ModelConfig,
    contextMax: number,
    signal: AbortSignal
  ): Promise<SubAgentResult> {
    const maxTurns = 30; // 子代理的轮次限制较小
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTokens = 0;
    const filesProcessed = new Set<string>();
    const findings: string[] = [];

    for (let turn = 0; turn < maxTurns; turn++) {
      if (signal.aborted) break;

      const callbacks: StreamCallbacks = {
        onContent: (text) => {
          this.win.webContents.send('agent:stream-chunk', {
            type: 'sub-agent-chunk',
            taskId: task.id,
            chunkType: 'content',
            text,
          });
        },
        onThinking: (text) => {
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
          signal
        );
      } catch (err: any) {
        if (signal.aborted) break;
        throw err;
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
        // 子代理完成任务
        if (result.content || result.thinking) {
          messages.push({
            role: 'assistant',
            content: result.content || '',
          });
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
      messages.push({
        role: 'assistant',
        content: result.content || '',
        tool_calls: assistantToolCalls,
      });

      for (const tc of result.toolCalls) {
        const tool = tools.find((t) => t.name === tc.name);
        let toolResult = '';
        if (!tool) {
          toolResult = `未知工具: ${tc.name}`;
        } else {
          try {
            const args = JSON.parse(tc.arguments || '{}');
            toolResult = await tool.execute(args);
          } catch (err: any) {
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

    // 提取最终的总结和发现
    const lastAssistantMessage = messages
      .filter((m) => m.role === 'assistant' && m.content)
      .pop();
    const summary = lastAssistantMessage?.content || '子代理未给出总结';

    return {
      taskId: task.id,
      success: true,
      summary,
      filesProcessed: Array.from(filesProcessed),
      findings,
      tokenUsage: {
        prompt: totalPrompt,
        completion: totalCompletion,
        total: totalTokens,
      },
    };
  }
}
