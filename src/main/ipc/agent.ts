import { ipcMain, BrowserWindow } from 'electron';
import { streamChat } from '../agent/client';
import { buildCachePrefix, buildMessages } from '../agent/cache';
import { getAllTools, getToolSchemas, ToolDef } from '../agent/tools';
import { buildProjectContext } from '../agent/context';
import { SubAgentManager } from '../agent/sub-agent';
import { getSystemPrompt, AgentMode } from '../agent/prompt';
import { getSetting } from '../db/settings';
import { errorLog, infoLog } from '../logger';
import { compressToolResult } from '../agent/compression';
import { buildExploreState, shouldContinueExplore, buildExploreNudge, buildExploreCompletionNudge } from '../agent/explore-monitor';
import { pluginManager } from '../plugin/manager';


let activeAbort: AbortController | null = null;
let activeSubAgentManager: SubAgentManager | null = null;


function buildToolPreview(name: string, argsJson: string): string {
  try {
    const a = JSON.parse(argsJson || '{}');
    if (name === 'write_file') {
      const content = (a.content || '').slice(0, 3000);
      return '文件: ' + (a.path || '?') + '\n\n' + content.split('\n').map((l: string) => '+ ' + l).join('\n') + (a.content && a.content.length > 3000 ? '\n+ ...(已截断)' : '');
    }
    if (name === 'edit_file') {
      const oldStr = (a.old_string || '').slice(0, 1500);
      const newStr = (a.new_string || '').slice(0, 1500);
      let diff = '文件: ' + (a.path || '?') + '\n\n';
      diff += oldStr.split('\n').map((l: string) => '- ' + l).join('\n') + '\n';
      diff += newStr.split('\n').map((l: string) => '+ ' + l).join('\n');
      if (a.old_string && a.old_string.length > 1500) diff += '\n- ...(已截断)';
      if (a.new_string && a.new_string.length > 1500) diff += '\n+ ...(已截断)';
      return diff;
    }
    if (name === 'bash') return '$ ' + (a.command || '?');
  } catch {}
  return argsJson || '';
}

export function setupAgentHandlers() {
  ipcMain.handle('agent:send', async (event, payload: {
    messages: Array<{ role: string; content: string; reasoning_content?: string; tool_calls?: any[] }>;
    apiKey: string;
    projectDir: string;
    newMessage: string;
    model?: string;
    baseUrl?: string;
    contextMax?: number;
    commandPrompt?: string;
    mode?: AgentMode;
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('No window');

    const abortController = new AbortController();
    activeAbort = abortController;

    infoLog('agent', 'send-start', { model: payload.model, mode: payload.mode, provider: (payload as any).provider, msgCount: payload.messages.length, newMsgLen: payload.newMessage.length });

    try {
      const tools = getAllTools(payload.projectDir);
    const projectContext = buildProjectContext(payload.projectDir);
    const subAgentManager = new SubAgentManager(win);
    activeSubAgentManager = subAgentManager;

    // 根据模式选择 system prompt，命令 prompt 追加在后
    const baseSystemPrompt = getSystemPrompt(payload.mode);
    const pluginPrompts = pluginManager.getSystemPrompts();
    const fullSystemPrompt = payload.commandPrompt
      ? `${baseSystemPrompt}\n\n${pluginPrompts}\n\n## 当前命令模式\n${payload.commandPrompt}`
      : pluginPrompts ? `${baseSystemPrompt}\n\n${pluginPrompts}` : baseSystemPrompt;

    const prefix = buildCachePrefix(fullSystemPrompt, projectContext);
    let messages: any[] = buildMessages(prefix, payload.messages, payload.newMessage);

    const builtTotalChars = messages.reduce((sum: number, m: any) => sum + (m.content?.length ?? 0), 0);
    infoLog('agent', 'messages-built', { msgCount: messages.length, sysPromptLen: prefix.systemPrompt.length, ctxLen: prefix.projectContext.length });

    const modelConfig = {
      model: payload.model || 'deepseek-chat',
      baseUrl: payload.baseUrl ?? 'https://api.deepseek.com',
    };
    const enableTools = true;
    const toolSchemas = enableTools ? getToolSchemas(tools) : [];

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTokens = 0;
    let totalToolTokens = 0;

    // 粗略估算工具调用 token：字符数 / 4（OpenAI tokenizer 近似值）
    function estimateTokens(str: string): number {
      return Math.max(1, Math.ceil(str.length / 4));
    }

    // 截断 tool result 中的 base64 图片数据，防止上下文膨胀
    function truncateToolResult(result: string): string {
      const base64Regex = /data:image\/\w+;base64,[A-Za-z0-9+/=]{500,}/g;
      if (!base64Regex.test(result)) return result;
      base64Regex.lastIndex = 0;
      return result.replace(base64Regex, (match) =>
        match.slice(0, 80) + `...[base64数据已截断，原长度${match.length}字符]`
      );
    }

    // 固定最大轮次：编程模式 50 轮，非编程模式 1 轮
    const maxTurns = enableTools ? 50 : 1;

    for (let turn = 0; turn < maxTurns; turn++) {
      if (abortController.signal.aborted) break;

      let result;
      // 主进程侧批量发送 content/thinking，每 16ms 一次，减少 IPC 消息量
      let contentBuf = '';
      let thinkingBuf = '';
      let flushTimer: ReturnType<typeof setInterval> | null = null;
      function flushStreamBuf() {
        if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
        if (contentBuf) {
          win!.webContents.send('agent:stream-chunk', { type: 'content', text: contentBuf, step: turn + 1, total: maxTurns });
          contentBuf = '';
        }
        if (thinkingBuf) {
          win!.webContents.send('agent:stream-chunk', { type: 'thinking', text: thinkingBuf, step: turn + 1, total: maxTurns });
          thinkingBuf = '';
        }
      }

      try {
        flushTimer = setInterval(() => {
          if (contentBuf) {
            win.webContents.send('agent:stream-chunk', { type: 'content', text: contentBuf, step: turn + 1, total: maxTurns });
            contentBuf = '';
          }
          if (thinkingBuf) {
            win.webContents.send('agent:stream-chunk', { type: 'thinking', text: thinkingBuf, step: turn + 1, total: maxTurns });
            thinkingBuf = '';
          }
        }, 16);

        result = await streamChat(
          payload.apiKey,
          messages,
          toolSchemas,
          modelConfig,
          {
            onContent: (text) => { contentBuf += text; },
            onThinking: (text) => { thinkingBuf += text; },
          },
          abortController.signal
        );
        flushStreamBuf();
      } catch (err: any) {
        flushStreamBuf();
        if (abortController.signal.aborted) break;
        const message = err?.message || String(err);

        // 上下文溢出时，激进压缩消息后重试一次
        const isContextOverflow = message.includes('maximum context length');
        if (isContextOverflow) {
          // 先截断过长的 system 消息
          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'system' && typeof messages[i].content === 'string' && messages[i].content.length > 500) {
              messages[i].content = messages[i].content.slice(0, 500) + '\n...[已截断]...';
            }
          }
          // 再压缩所有 tool 消息
          let compressed = 0;
          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'tool' && typeof messages[i].content === 'string' && messages[i].content.length > 100) {
              messages[i].content = compressToolResult(messages[i].content);
              compressed++;
            }
          }
          win.webContents.send('agent:stream-chunk', {
            type: 'content',
            text: `\n[系统提示：上下文溢出（${message.match(/requested (\d+)/)?.[1] || '?'} tokens），已压缩 ${compressed} 个工具调用结果，正在重试...]\n`,
            step: turn + 1,
            total: maxTurns,
          });

          // 重试本次 API 调用
          try {
            result = await streamChat(
              payload.apiKey,
              messages,
              toolSchemas,
              modelConfig,
              {
                onContent: (text) => {
                  win.webContents.send('agent:stream-chunk', { type: 'content', text, step: turn + 1, total: maxTurns });
                },
                onThinking: (text) => {
                  win.webContents.send('agent:stream-chunk', { type: 'thinking', text, step: turn + 1, total: maxTurns });
                },
              },
              abortController.signal
            );
          } catch (retryErr: any) {
            if (abortController.signal.aborted) break;
            const retryMsg = retryErr?.message || String(retryErr);
            win.webContents.send('agent:stream-chunk', { type: 'error', message: retryMsg });
            win.webContents.send('agent:stream-chunk', { type: 'done' });
            activeAbort = null;
            activeSubAgentManager?.cancelAllSubAgents();
            activeSubAgentManager = null;
            return { success: false, error: retryMsg };
          }
          // 重试成功，跳过原来的 error 发送
        } else {
          win.webContents.send('agent:stream-chunk', { type: 'error', message });
          win.webContents.send('agent:stream-chunk', { type: 'done' });
          activeAbort = null;
          activeSubAgentManager?.cancelAllSubAgents();
          activeSubAgentManager = null;
          return { success: false, error: message };
        }
      }

      if (abortController.signal.aborted) break;

      if (result.usage) {
        totalPrompt += result.usage.prompt_tokens;
        totalCompletion += result.usage.completion_tokens;
        totalTokens += result.usage.total_tokens;
        const currentPrompt = result.usage.prompt_tokens;
        win.webContents.send('agent:stream-chunk', {
          type: 'usage',
          prompt: totalPrompt,
          completion: totalCompletion,
          total: totalTokens,
          toolTokens: totalToolTokens,
          currentPrompt,
          contextMax: payload.contextMax || 100000,
        });

        // 上下文压缩：当接近上下文限制时（80%），压缩早期的工具调用结果
        const contextMax = payload.contextMax || 100000;
        if (currentPrompt > contextMax * 0.8) {
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
              messages[idx].content = compressToolResult(originalContent);
            }
          }

          win.webContents.send('agent:stream-chunk', {
            type: 'content',
            text: `\n[系统提示：已压缩 ${compressCount} 个早期工具调用结果以节省上下文]\n`,
          });
        }
      }

      if (result.toolCalls.length === 0) {
        // 处理空响应：thinking 模型可能撞 max_tokens 后 content 为空，或 API 返回了空体
        if (!result.content) {
          if (result.finishReason === 'length') {
            const hint = result.thinking
              ? '模型在思考阶段就用完了 token 配额，没有生成正文。建议：拆分任务、缩减上下文，或换用更大输出预算的模型。'
              : '模型输出被 max_tokens 截断且无内容。建议增加输出预算或简化提问。';
            win.webContents.send('agent:stream-chunk', { type: 'error', message: hint });
            break;
          }
          if (!result.thinking) {
            win.webContents.send('agent:stream-chunk', {
              type: 'error',
              message: `模型返回空响应（finish_reason=${result.finishReason ?? '未知'}）。可能是上游临时故障，请重试。`,
            });
            break;
          }
          // 只有 thinking 没 content：把 thinking 当作回复展示，避免空白
          win.webContents.send('agent:stream-chunk', {
            type: 'content',
            text: `\n[模型仅输出了思考过程，未生成正文。以下为思考内容摘要]\n${result.thinking.slice(0, 2000)}${result.thinking.length > 2000 ? '\n...(已截断)' : ''}\n`,
          });
        }

        // 模型给出最终回复，推入 messages 以保存对话历史
        if (result.content || result.thinking) {
          const assistantMsg: any = {
            role: 'assistant',
            content: result.content || '',
          };
          if (result.thinking) {
            assistantMsg.reasoning_content = result.thinking;
          }
          messages.push(assistantMsg);
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

        // 判断是否为探索任务：只用了 read_file/list_files，且没有产出实质回复
        // 如果模型用了 edit_file/write_file/grep/bash 等生产工具，说明在干活不是探索
        const hasSubstantialOutput = result.content && result.content.length > 200;
        let hasProductiveToolCall = false;
        for (const m of messages) {
          if (m.role === 'assistant' && m.tool_calls) {
            for (const tc of m.tool_calls) {
              const name = tc.function?.name;
              if (name === 'edit_file' || name === 'write_file' || name === 'bash' || name === 'grep' || name === 'glob' || name === 'generate_image' || name === 'spawn_sub_agent') {
                hasProductiveToolCall = true;
              }
            }
          }
        }
        const isExploreMode = (readFileCount > 0 || listCount > 0) && !hasSubstantialOutput && !hasProductiveToolCall;

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

          // 发送读取率进度给前端
          win.webContents.send('agent:stream-chunk', {
            type: 'explore-progress',
            readPercentage,
            readFileCount,
            totalFiles,
            step: turn + 1,
            total: maxTurns,
          });

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
              type: 'explore-warning',
              warning: `已达到最大轮次限制（${maxTurns}轮），已读取 ${readPercentage}% 的文件（${readFileCount}/${totalFiles}）`,
            });
          }
        }

        // 纯对话模式（没有用任何工具），直接放行
        break;
      }

      const assistantToolCalls = result.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
      const toolMsg: any = {
        role: 'assistant',
        content: result.content || '',
        tool_calls: assistantToolCalls,
      };
      if (result.thinking) {
        toolMsg.reasoning_content = result.thinking;
      }
      messages.push(toolMsg);

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

            // 需要用户确认的工具：先发确认请求，再发 tool-call 事件
            if (tool.requiresConfirm) {
              const approved = await new Promise<boolean>((resolve) => {
                const confirmId = `confirm-${Date.now()}`;
                const preview = buildToolPreview(tc.name, tc.arguments); win.webContents.send('agent:confirm-request', { confirmId, name: tc.name, args: preview });
                let cleaned = false;
                const cleanup = () => {
                  if (cleaned) return;
                  cleaned = true;
                  ipcMain.removeListener('agent:confirm-response', handler);
                  abortController.signal.removeEventListener('abort', onAbort);
                };
                const handler = (_ev: any, resp: { confirmId: string; approved: boolean }) => {
                  if (resp.confirmId === confirmId) {
                    cleanup();
                    resolve(resp.approved);
                  }
                };
                const onAbort = () => {
                  cleanup();
                  resolve(false);
                };
                ipcMain.on('agent:confirm-response', handler);
                abortController.signal.addEventListener('abort', onAbort);
              });
              if (!approved) {
                toolResult = '用户拒绝了此操作';
                status = 'error';
                win.webContents.send('agent:stream-chunk', { type: 'tool-call', name: tc.name, args: tc.arguments, step: turn + 1, total: maxTurns });
                win.webContents.send('agent:stream-chunk', { type: 'tool-result', name: tc.name, result: toolResult, status, step: turn + 1, total: maxTurns });
                const truncatedResult = truncateToolResult(toolResult);
                totalToolTokens += estimateTokens(tc.arguments || '') + estimateTokens(truncatedResult);
                messages.push({ role: 'tool', tool_call_id: tc.id, content: truncatedResult });
                continue;
              }
            }

            // 发送 tool-call 事件（确认后或无需确认的工具）
            win.webContents.send('agent:stream-chunk', { type: 'tool-call', name: tc.name, args: tc.arguments, step: turn + 1, total: maxTurns });

            const imageModelRaw = getSetting('imageModel');
            const imageModelConfig = imageModelRaw ? JSON.parse(imageModelRaw) : null;
            const visionModelRaw = getSetting('visionModel');
            const visionModelConfig = visionModelRaw ? JSON.parse(visionModelRaw) : null;
            if (abortController.signal.aborted) break;

            const toolContext = {
              apiKey: payload.apiKey,
              modelConfig: {
                model: modelConfig.model,
                baseUrl: modelConfig.baseUrl,
              },
              contextMax: payload.contextMax || 100000,
              subAgentManager,
              signal: abortController.signal,
              projectDir: payload.projectDir,
              imageModelConfig: imageModelConfig?.enabled ? {
                enabled: true,
                baseUrl: imageModelConfig.baseUrl,
                model: imageModelConfig.model,
                apiKey: imageModelConfig.apiKey,
              } : undefined,
              visionModelConfig: visionModelConfig?.enabled ? {
                enabled: true,
                baseUrl: visionModelConfig.useActiveModel ? (modelConfig.baseUrl) : visionModelConfig.baseUrl,
                model: visionModelConfig.useActiveModel ? (modelConfig.model) : visionModelConfig.model,
                apiKey: visionModelConfig.useActiveModel ? (payload.apiKey) : visionModelConfig.apiKey,
              } : undefined,
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
          step: turn + 1,
          total: maxTurns,
        });
        const truncatedResult = truncateToolResult(toolResult);
        totalToolTokens += estimateTokens(tc.arguments || '') + estimateTokens(truncatedResult);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: truncatedResult,
        });
      }
      // 工具执行完毕，静默继续下一轮（不再往聊天里刷提示）
    }

    // 收集本次对话中修改过的文件
    activeAbort = null;
    activeSubAgentManager = null;
    win.webContents.send('agent:stream-chunk', { type: 'done' });
    return { success: true };
    } catch (err: any) {
      const message = err?.message || String(err);
      win.webContents.send('agent:stream-chunk', {
        type: 'error',
        message,
      });
      win.webContents.send('agent:stream-chunk', { type: 'done' });
      activeAbort = null;
      activeSubAgentManager?.cancelAllSubAgents();
      activeSubAgentManager = null;
      return { success: false, error: message };
    }
  });

  ipcMain.handle('agent:cancel', async () => {
    activeAbort?.abort();
    activeAbort = null;
    activeSubAgentManager?.cancelAllSubAgents();
    activeSubAgentManager = null;
    return { success: true };
  });
}
