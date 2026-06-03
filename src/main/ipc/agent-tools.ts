import fs from 'fs';
import { ipcMain, BrowserWindow } from 'electron';
import type { ToolDef } from '../agent/tools';
import type { MultiAgentRole } from '../agent/tools/index';
import { normalizePlanTodos } from '../agent/tools/write-todos';
import { getSetting } from '../db/settings';
import { resolveImageModelConfig } from '../services/image-model-config';
import { errorLog, infoLog } from '../logger';
import { buildVisionToolContext } from '../agent/vision-config';
import { SubAgentManager } from '../agent/sub-agent';

const fileWatchers = new Map<string, fs.FSWatcher>();

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

function estimateTokens(str: string): number {
  return Math.max(1, Math.ceil(str.length / 4));
}

function truncateToolResult(result: string): string {
  const base64Regex = /data:image\/\w+;base64,[A-Za-z0-9+/=]{500,}/g;
  if (!base64Regex.test(result)) return result;
  base64Regex.lastIndex = 0;
  return result.replace(base64Regex, (match) =>
    match.slice(0, 80) + `...[base64数据已截断，原长度${match.length}字符]`
  );
}

export interface ToolContext {
  apiKey: string;
  modelConfig: { model: string; baseUrl: string };
  contextMax: number;
  subAgentManager: SubAgentManager;
  signal: AbortSignal;
  projectDir: string;
  imageModelConfig: any;
  visionModelConfig: any;
  multiAgentRoles: MultiAgentRole[];
}

interface ToolCallResult {
  name: string;
  argsJson: string;
  toolResult: string;
  status: 'success' | 'error';
  toolTokens: number;
}

/**
 * 执行单个工具调用（含确认逻辑）
 */
async function executeSingleTool(
  win: BrowserWindow,
  sessionId: string,
  event: Electron.IpcMainInvokeEvent,
  tc: { id: string; name: string; arguments: string },
  tool: ToolDef | undefined,
  ctx: ToolContext,
  abortController: AbortController,
  step: number,
  total: number,
): Promise<ToolCallResult> {
  if (!tool) {
    return { name: tc.name, argsJson: tc.arguments, toolResult: `未知工具: ${tc.name}`, status: 'error', toolTokens: 0 };
  }

  try {
    const args = JSON.parse(tc.arguments || '{}');

    // 需要用户确认的工具
    if (tool.requiresConfirm) {
      const approved = await requestConfirm(win, sessionId, event, tc, abortController);
      if (!approved) {
        const result = '用户拒绝了此操作';
        win.webContents.send('agent:stream-chunk', { sessionId, type: 'tool-call', name: tc.name, args: tc.arguments, step, total });
        win.webContents.send('agent:stream-chunk', { sessionId, type: 'tool-result', name: tc.name, result, status: 'error', step, total });
        return { name: tc.name, argsJson: tc.arguments, toolResult: truncateToolResult(result), status: 'error', toolTokens: estimateTokens(tc.arguments || '') + estimateTokens(result) };
      }
    }

    win.webContents.send('agent:stream-chunk', { sessionId, type: 'tool-call', name: tc.name, args: tc.arguments, step, total });

    const imageModelRaw = getSetting('imageModel');
    const imageModelConfig = resolveImageModelConfig(imageModelRaw, ctx.apiKey);
    if (abortController.signal.aborted) {
      return { name: tc.name, argsJson: tc.arguments, toolResult: '已取消', status: 'error', toolTokens: 0 };
    }

    const toolContext = { ...ctx, imageModelConfig, visionModelConfig: buildVisionToolContext(ctx.modelConfig, ctx.apiKey, false) };
    const rawResult = await tool.execute(args, toolContext);
    const truncated = truncateToolResult(rawResult);

    win.webContents.send('agent:stream-chunk', { sessionId, type: 'tool-result', name: tc.name, result: rawResult, status: 'success', step, total });

    return { name: tc.name, argsJson: tc.arguments, toolResult: truncated, status: 'success', toolTokens: estimateTokens(tc.arguments || '') + estimateTokens(truncated) };
  } catch (err: any) {
    const result = err.message || String(err);
    win.webContents.send('agent:stream-chunk', { sessionId, type: 'tool-result', name: tc.name, result, status: 'error', step, total });
    return { name: tc.name, argsJson: tc.arguments, toolResult: truncateToolResult(result), status: 'error', toolTokens: estimateTokens(tc.arguments || '') + estimateTokens(result) };
  }
}

/**
 * 弹出确认对话框等待用户响应
 */
async function requestConfirm(
  win: BrowserWindow,
  sessionId: string,
  event: Electron.IpcMainInvokeEvent,
  tc: { name: string; arguments: string },
  abortController: AbortController,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const confirmId = `confirm-${Date.now()}`;
    const preview = buildToolPreview(tc.name, tc.arguments);
    win.webContents.send('agent:confirm-request', { confirmId, name: tc.name, args: preview });

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      ipcMain.removeListener('agent:confirm-response', handler);
      abortController.signal.removeEventListener('abort', onAbort);
    };

    const handler = (ev: Electron.IpcMainEvent, resp: { confirmId: string; approved: boolean }) => {
      if (ev.sender !== event.sender) return;
      if (resp.confirmId === confirmId) { cleanup(); resolve(resp.approved); }
    };

    const onAbort = () => { cleanup(); resolve(false); };

    ipcMain.on('agent:confirm-response', handler);
    abortController.signal.addEventListener('abort', onAbort);
  });
}

/**
 * 工具调用后处理：子代理提示、plan-todos、web-preview
 */
function handleToolPostProcessing(
  win: BrowserWindow,
  sessionId: string,
  tc: { name: string; arguments: string },
  toolResult: string,
  status: 'success' | 'error',
): string | undefined {
  // 子代理/角色代理结束后追加提示
  if (tc.name === 'spawn_sub_agent' || tc.name === 'auto_decompose_task' || tc.name === 'spawn_role_agents') {
    return '子代理/角色代理工具调用已结束。请阅读上方 tool 返回中的成功/失败详情，现在立刻向用户输出完整汇总（必须说明失败原因与后续计划），不要再次调用分派类工具。';
  }

  if (status !== 'success') return undefined;

  // write_todos → plan-todos 事件
  if (tc.name === 'write_todos') {
    try {
      const parsed = JSON.parse(tc.arguments || '{}');
      const todos = normalizePlanTodos(parsed.todos);
      if (todos.length > 0) {
        win.webContents.send('agent:stream-chunk', { sessionId, type: 'plan-todos', todos, planDocPath: typeof parsed.plan_doc_path === 'string' ? parsed.plan_doc_path : undefined });
      }
    } catch { /* ignore malformed args */ }
  }

  // present_web → web-preview 事件 + 文件监听
  if (tc.name === 'present_web') {
    try {
      const parsed = JSON.parse(toolResult || '{}');
      if (parsed.opened === 'watch' && typeof parsed.file === 'string') {
        const filePath = parsed.file;
        if (fileWatchers.has(filePath)) fileWatchers.get(filePath)!.close();
        if (typeof parsed.initialHtml === 'string') {
          win.webContents.send('agent:stream-chunk', { sessionId, type: 'web-preview', html: parsed.initialHtml, file: filePath });
        }
        const watcher = fs.watch(filePath, () => {
          try {
            const updated = fs.readFileSync(filePath, 'utf-8');
            win.webContents.send('agent:stream-chunk', { sessionId, type: 'web-preview', html: updated, file: filePath });
          } catch { /* file may be temporarily locked */ }
        });
        fileWatchers.set(filePath, watcher);
        infoLog('agent', 'web-preview-watch', { file: filePath });
      } else if (parsed.opened === 'inline' && typeof parsed.html === 'string') {
        win.webContents.send('agent:stream-chunk', { sessionId, type: 'web-preview', html: parsed.html });
        infoLog('agent', 'web-preview-inline', { htmlLen: parsed.html.length });
      }
    } catch (e: any) {
      errorLog('agent', 'web-preview-parse-error', { error: e?.message });
    }
  }

  return undefined;
}

/**
 * 执行全部工具调用并返回追加的消息列表
 */
export async function executeToolCalls(
  win: BrowserWindow,
  sessionId: string,
  event: Electron.IpcMainInvokeEvent,
  tools: ToolDef[],
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
  ctx: ToolContext,
  abortController: AbortController,
  step: number,
  total: number,
): Promise<{ toolMessages: any[]; totalToolTokens: number }> {
  const toolMessages: any[] = [];
  let totalToolTokens = 0;

  for (const tc of toolCalls) {
    if (abortController.signal.aborted) break;

    const tool = tools.find(t => t.name === tc.name);
    const result = await executeSingleTool(win, sessionId, event, tc, tool, ctx, abortController, step, total);

    totalToolTokens += result.toolTokens;
    toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result.toolResult });

    const nudge = handleToolPostProcessing(win, sessionId, tc, result.toolResult, result.status);
    if (nudge) {
      toolMessages.push({ role: 'user', content: nudge });
    }
  }

  return { toolMessages, totalToolTokens };
}

/** 清理所有 web-preview 文件监听器 */
export function cleanupFileWatchers() {
  for (const w of fileWatchers.values()) w.close();
  fileWatchers.clear();
}
