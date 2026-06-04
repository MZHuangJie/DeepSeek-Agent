import { BrowserWindow } from 'electron';
import { streamChat } from '../agent/client';
import type { ToolDef } from '../agent/tools';
import { AppError } from '../agent/errors';
import { compressToolResult } from '../agent/compression';

/**
 * 流式缓冲区：将高频 content/thinking 累积后批量发送到渲染进程（16ms 间隔）
 */
export function createStreamBuffer(win: BrowserWindow, sessionId: string) {
  let contentBuf = '';
  let thinkingBuf = '';
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let curStep = 0, curTotal = 0;

  function flush() {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    if (win.isDestroyed()) return;
    if (contentBuf) {
      win.webContents.send('agent:stream-chunk', { sessionId, type: 'content', text: contentBuf, step: curStep, total: curTotal });
      contentBuf = '';
    }
    if (thinkingBuf) {
      win.webContents.send('agent:stream-chunk', { sessionId, type: 'thinking', text: thinkingBuf, step: curStep, total: curTotal });
      thinkingBuf = '';
    }
  }

  function start(step: number, total: number) {
    curStep = step; curTotal = total;
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(() => {
      if (win.isDestroyed()) return;
      if (contentBuf) {
        win.webContents.send('agent:stream-chunk', { sessionId, type: 'content', text: contentBuf, step, total });
        contentBuf = '';
      }
      if (thinkingBuf) {
        win.webContents.send('agent:stream-chunk', { sessionId, type: 'thinking', text: thinkingBuf, step, total });
        thinkingBuf = '';
      }
    }, 16);
  }

  return {
    onContent: (text: string) => { contentBuf += text; },
    onThinking: (text: string) => { thinkingBuf += text; },
    start,
    flush,
  };
}

/**
 * 带缓冲区与上下文溢出重试的流式 API 调用
 */
export async function runStreamChat(
  win: BrowserWindow,
  sessionId: string,
  apiKey: string,
  messages: any[],
  toolSchemas: any[],
  modelConfig: { model: string; baseUrl: string },
  abortSignal: AbortSignal,
  step: number,
  total: number,
): Promise<Awaited<ReturnType<typeof streamChat>>> {
  const buf = createStreamBuffer(win, sessionId);
  buf.start(step, total);

  let result;
  try {
    result = await streamChat(
      apiKey, messages, toolSchemas, modelConfig,
      { onContent: buf.onContent, onThinking: buf.onThinking },
      abortSignal,
    );
    buf.flush();
    return result;
  } catch (err: any) {
    buf.flush();
    if (abortSignal.aborted) throw err;

    const message = err instanceof AppError ? err.userMessage : (err?.message || String(err));
    const isContextOverflow = message.includes('maximum context length');

    if (!isContextOverflow) throw err;

    // 上下文溢出：激进压缩后重试
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system' && typeof messages[i].content === 'string' && messages[i].content.length > 500) {
        messages[i].content = messages[i].content.slice(0, 500) + '\n...[已截断]...';
      }
    }

    let compressed = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'tool' && typeof messages[i].content === 'string' && messages[i].content.length > 100) {
        messages[i].content = compressToolResult(messages[i].content);
        compressed++;
      }
    }

    win.webContents.send('agent:stream-chunk', {
      sessionId,
      type: 'content',
      text: `\n[系统提示：上下文溢出（${message.match(/requested (\d+)/)?.[1] || '?'} tokens），已压缩 ${compressed} 个工具调用结果，正在重试...]\n`,
      step,
      total,
    });

    // 重试（不用缓冲区，直接发送）
    return streamChat(
      apiKey, messages, toolSchemas, modelConfig,
      {
        onContent: (text) => win.webContents.send('agent:stream-chunk', { sessionId, type: 'content', text, step, total }),
        onThinking: (text) => win.webContents.send('agent:stream-chunk', { sessionId, type: 'thinking', text, step, total }),
      },
      abortSignal,
    );
  }
}
