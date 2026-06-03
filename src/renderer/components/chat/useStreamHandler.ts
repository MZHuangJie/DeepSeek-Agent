import { useRef, useEffect } from 'react';
import type { StreamChunk } from '../../types/stream';
import { useChatStore } from '../../stores/chat';
import { useAgentStore } from '../../stores/agent';
import { useModeStore } from '../../stores/mode';
import { useRoleplayStore } from '../../stores/roleplay';
import { buildToolActivity, computeSubAgentProgress, isUsefulSubAgentSnippet } from './subAgentUi';
import { summarizeSessionTitleIfNeeded } from '../../utils/sessionTitleSummarize';
import {
  getCharactersByIds,
  mapTurnsToMeta,
  resolveSessionCast,
} from '../../utils/roleplay-multi';
import {
  parseRoleplayResponse,
  parseMultiRoleplayResponse,
  stripRoleplayReplyTags,
} from '../../utils/parseRoleplayResponse';

interface StreamHandlerDeps {
  targetSessionRef: React.MutableRefObject<string | null>;
  setStreaming: (v: boolean) => void;
  setErrorMsg: (msg: string) => void;
  onDone?: () => void;
}

interface SessionBuffer {
  currentStep: number;
  totalContent: string;
  totalThinking: string;
  pendingContent: string;
  pendingThinking: string;
  rafId: number | null;
}

function buildMessageUpdate(
  sid: string,
  totalContent: string,
  totalThinking: string,
): Partial<import('../../stores/chat').Message> {
  const upd: Partial<import('../../stores/chat').Message> = {};
  if (totalThinking) upd.thinkingContent = totalThinking;

  if (totalContent) {
    const chat = useChatStore.getState();
    const session = chat.sessions.find(s => s.id === sid);
    const raw = totalContent;
    // 与 MessageBubble 的判断逻辑对齐：sessionMode、当前全局 mode、或内容本身含角色扮演标签
    const isRoleplay =
      session?.sessionMode === 'roleplay'
      || useModeStore.getState().mode === 'roleplay'
      || new RegExp('<\\/?reply\\s*>|<\\/?status\\s*>|<\\/?turn\\s*>', 'i').test(raw);

    if (isRoleplay) {
      const cast = resolveSessionCast(session);
      const participants = getCharactersByIds(
        useRoleplayStore.getState().characters,
        cast.participantIds,
      );

      if (cast.isMulti) {
        const parsed = parseMultiRoleplayResponse(raw);
        const streaming = chat.isStreaming;
        if (parsed.turns.length > 0) {
          upd.content = parsed.displayText || stripRoleplayReplyTags(raw);
        } else if (streaming) {
          upd.content = stripRoleplayReplyTags(
            raw.replace(/<status\s*>[\s\S]*$/i, '').replace(/<\/?scene\s*>/gi, ''),
          ) || raw;
        } else {
          upd.content = parsed.displayText || stripRoleplayReplyTags(raw);
        }
        upd.rawContent = raw;
        if (parsed.turns.length > 0) {
          upd.roleplayMeta = { turns: mapTurnsToMeta(parsed.turns, participants) };
        }
      } else {
        const parsed = parseRoleplayResponse(raw);
        let content = parsed.reply
          || stripRoleplayReplyTags(raw.replace(/<status\s*>[\s\S]*$/i, ''))
          || raw;
        // 清理开头可能导致 Markdown 渲染异常的 blockquote/table 标记
        content = content.replace(/^(\s*[>|])+\s*/, '').trim();
        upd.content = content;
        upd.rawContent = raw;
        if (parsed.status && parsed.statusComplete) {
          upd.roleplayMeta = { status: parsed.status, statusComplete: true };
        } else if (parsed.status) {
          upd.roleplayMeta = { status: parsed.status, statusComplete: false };
        }
      }
    } else {
      upd.content = totalContent;
    }
  }

  return upd;
}

export function useStreamHandler(deps: StreamHandlerDeps) {
  const { targetSessionRef, setStreaming, setErrorMsg, onDone } = deps;

  // 每个 session 独立维护自己的 buffer，避免多 tab 并发时串内容
  const buffersRef = useRef(new Map<string, SessionBuffer>());

  const getBuffer = (sid: string): SessionBuffer => {
    let buf = buffersRef.current.get(sid);
    if (!buf) {
      buf = {
        // 调用方（handleSend / sendCharacterOpening）已提前 addMessage 创建空 assistant，
        // 初始 step 设为 1，避免第一个 content chunk（step=1）误触发 newAssistantMessage
        // 导致出现多余的空消息（显示为 "..."）
        currentStep: 1,
        totalContent: '',
        totalThinking: '',
        pendingContent: '',
        pendingThinking: '',
        rafId: null,
      };
      buffersRef.current.set(sid, buf);
    }
    return buf;
  };

  const flushBuffer = (sid: string) => {
    const buf = buffersRef.current.get(sid);
    if (!buf || (!buf.pendingContent && !buf.pendingThinking)) return;

    buf.totalContent += buf.pendingContent;
    buf.totalThinking += buf.pendingThinking;
    buf.pendingContent = '';
    buf.pendingThinking = '';

    const upd = buildMessageUpdate(sid, buf.totalContent, buf.totalThinking);
    useChatStore.getState().updateLastAssistant(upd, sid);
  };

  const scheduleRaf = (sid: string) => {
    const buf = getBuffer(sid);
    if (!buf.rafId) {
      buf.rafId = requestAnimationFrame(() => {
        buf.rafId = null;
        flushBuffer(sid);
      });
    }
  };

  const cancelRaf = (sid: string) => {
    const buf = buffersRef.current.get(sid);
    if (buf?.rafId) {
      cancelAnimationFrame(buf.rafId);
      buf.rafId = null;
    }
  };

  useEffect(() => () => {
    buffersRef.current.forEach(buf => {
      if (buf.rafId) cancelAnimationFrame(buf.rafId);
    });
    buffersRef.current.clear();
  }, []);

  const handleChunk = (chunk: StreamChunk) => {
    // 优先使用 IPC 消息中携带的 sessionId，支持多 tab 同时流式输出
    const sid = chunk.sessionId || targetSessionRef.current;
    if (!sid) return;

    const { sessions, updateLastAssistant } = useChatStore.getState();
    const sess = sessions.find(s => s.id === sid);
    const lastMsg = sess?.messages.at(-1);

    if (chunk.type === 'content') {
      const buf = getBuffer(sid);
      const step = chunk.step || 1;
      if (step > buf.currentStep) {
        buf.currentStep = step;
        cancelRaf(sid);
        flushBuffer(sid);
        buf.totalContent = '';
        buf.totalThinking = '';
        buf.pendingContent = '';
        buf.pendingThinking = '';
        useChatStore.getState().newAssistantMessage(sid);
      }
      buf.pendingContent += chunk.text;
      scheduleRaf(sid);
    } else if (chunk.type === 'thinking') {
      const buf = getBuffer(sid);
      const step = chunk.step || 0;
      if (step > 0 && step > buf.currentStep) {
        buf.currentStep = step;
        cancelRaf(sid);
        flushBuffer(sid);
        buf.totalContent = '';
        buf.totalThinking = '';
        buf.pendingContent = '';
        buf.pendingThinking = '';
        useChatStore.getState().newAssistantMessage(sid);
      }
      buf.pendingThinking += chunk.text;
      scheduleRaf(sid);
    } else if (chunk.type === 'tool-call') {
      const buf = getBuffer(sid);
      const step = chunk.step || 1;
      if (step > buf.currentStep) {
        buf.currentStep = step;
        cancelRaf(sid);
        flushBuffer(sid);
        buf.totalContent = '';
        buf.totalThinking = '';
        buf.pendingContent = '';
        buf.pendingThinking = '';
        useChatStore.getState().newAssistantMessage(sid);
      }
      let parsedArgs: Record<string, unknown> = {};
      try { parsedArgs = JSON.parse(chunk.args || '{}'); } catch { parsedArgs = { _raw: chunk.args }; }
      const current = lastMsg?.toolCalls ?? [];
      updateLastAssistant({
        toolCalls: [...current, { name: chunk.name, args: parsedArgs, status: 'running', timestamp: Date.now() }],
      }, sid);
      useAgentStore.getState().addToolCall({
        id: `tc-${Date.now()}`, name: chunk.name, args: chunk.args || '{}', status: 'running', timestamp: Date.now(),
      });
    } else if (chunk.type === 'tool-result') {
      const current = lastMsg?.toolCalls ?? [];
      const matchedIdx = current.reduceRight((found: number, tc, idx: number) => {
        if (found >= 0) return found;
        if (tc.status === 'running' && tc.name === chunk.name) return idx;
        return -1;
      }, -1);
      const targetIdx = matchedIdx >= 0 ? matchedIdx : current.length - 1;
      updateLastAssistant({
        toolCalls: current.map((tc, idx: number) =>
          idx === targetIdx ? { ...tc, result: chunk.result, status: chunk.status } : tc
        ),
      }, sid);
      const lastTc = useAgentStore.getState().toolCalls[useAgentStore.getState().toolCalls.length - 1];
      if (lastTc) useAgentStore.getState().updateToolCall(lastTc.id, { result: chunk.result, status: chunk.status });
    } else if (chunk.type === 'usage') {
      useAgentStore.getState().setMainTokenStats({
        total: chunk.total, prompt: chunk.prompt, completion: chunk.completion,
        toolTokens: chunk.toolTokens ?? 0, contextWindow: chunk.currentPrompt || chunk.prompt || 0,
        contextMax: chunk.contextMax || 100000, cost: parseFloat((chunk.total * 0.000002).toFixed(3)),
      });
    } else if (chunk.type === 'done') {
      cancelRaf(sid);
      flushBuffer(sid);
      buffersRef.current.delete(sid);
      setStreaming(false);
      // 只有当前锁定的 session 完成时才清除锁定，避免后台 session 误清
      if (targetSessionRef.current === sid) {
        targetSessionRef.current = null;
      }
      const current = useAgentStore.getState().currentStep;
      useAgentStore.getState().setCurrentStep({
        step: current?.step || 1, total: current?.total || 1, description: '已完成', progress: 100,
      });
      void summarizeSessionTitleIfNeeded(sid);
      useAgentStore.getState().refreshBalance();
      onDone?.();
    } else if (chunk.type === 'explore-progress') {
      const agentStore = useAgentStore.getState();
      agentStore.setCurrentStep({
        step: chunk.step || 1, total: chunk.total || 1,
        description: `正在读取项目文件，已读取 ${chunk.readFileCount}/${chunk.totalFiles} 个文件`,
        progress: Math.min(99, chunk.readPercentage || 0),
        readPercentage: chunk.readPercentage, readFileCount: chunk.readFileCount, totalFiles: chunk.totalFiles,
      });
      agentStore.setExploreProgress({
        readPercentage: chunk.readPercentage, readFileCount: chunk.readFileCount,
        totalFiles: chunk.totalFiles, step: chunk.step || 1, total: chunk.total || 1,
      });
    } else if (chunk.type === 'explore-warning') {
      const prev = useAgentStore.getState().exploreProgress;
      if (prev) useAgentStore.getState().setExploreProgress({ ...prev, warning: chunk.warning });
    } else if (chunk.type === 'sub-agent-start') {
      useAgentStore.getState().addSubAgent({
        id: chunk.taskId,
        type: chunk.subAgentType as 'explore' | 'analyze' | 'implement' | 'review',
        description: chunk.description || '',
        targetPath: chunk.targetPath || '',
        waveIndex: chunk.waveIndex,
        status: 'running',
        filesProcessed: 0,
        progress: 5,
        activityText: '正在启动子代理...',
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        findings: [],
        startTime: Date.now(),
      });
    } else if (chunk.type === 'sub-agent-chunk') {
      const sa = useAgentStore.getState().subAgents.find(s => s.id === chunk.taskId);
      if (!sa || sa.status === 'completed' || sa.status === 'failed') return;
      if (chunk.chunkType === 'content' && chunk.text) {
        if (!isUsefulSubAgentSnippet(chunk.text)) return;
        const snippet = chunk.text.replace(/\s+/g, ' ').trim().slice(0, 72);
        const nextProgress = Math.min(95, computeSubAgentProgress(sa) + 1);
        useAgentStore.getState().updateSubAgent(chunk.taskId, {
          activityText: snippet + (chunk.text.trim().length > 72 ? '…' : ''),
          progress: nextProgress,
        });
      }
    } else if (chunk.type === 'sub-agent-tool-call') {
      const sa = useAgentStore.getState().subAgents.find(s => s.id === chunk.taskId);
      if (!sa) return;
      const activity = buildToolActivity(chunk.name, chunk.args);
      const filesProcessed = chunk.name === 'read_file' ? sa.filesProcessed + 1 : sa.filesProcessed;
      useAgentStore.getState().updateSubAgent(chunk.taskId, {
        filesProcessed,
        currentTool: chunk.name,
        activityText: activity.activityText,
        currentFile: activity.currentFile ?? sa.currentFile,
        progress: Math.min(95, filesProcessed * 8 + Math.floor((sa.tokenUsage?.total || 0) / 1000) + 10),
      });
    } else if (chunk.type === 'sub-agent-usage') {
      const sa = useAgentStore.getState().subAgents.find(s => s.id === chunk.taskId);
      useAgentStore.getState().updateSubAgent(chunk.taskId, {
        tokenUsage: { prompt: chunk.prompt, completion: chunk.completion, total: chunk.total },
        progress: sa ? Math.min(95, computeSubAgentProgress({ ...sa, tokenUsage: { prompt: chunk.prompt, completion: chunk.completion, total: chunk.total } })) : undefined,
      });
    } else if (chunk.type === 'sub-agent-complete') {
      useAgentStore.getState().updateSubAgent(chunk.taskId, {
        status: chunk.success ? 'completed' : 'failed', summary: chunk.summary,
        filesProcessed: chunk.filesProcessed ?? 0,
        tokenUsage: chunk.tokenUsage ?? { prompt: 0, completion: 0, total: 0 },
        progress: 100,
        activityText: chunk.success ? '任务已完成' : (chunk.error || '任务失败'),
        error: chunk.error,
        endTime: Date.now(),
      });
    } else if (chunk.type === 'sub-agent-error') {
      useAgentStore.getState().updateSubAgent(chunk.taskId, {
        status: 'failed',
        error: chunk.error,
        activityText: chunk.error || '任务失败',
        progress: 100,
        endTime: Date.now(),
      });
    } else if (chunk.type === 'plan-todos') {
      if (Array.isArray(chunk.todos)) {
        useChatStore.getState().setPlanTodos(chunk.todos, chunk.planDocPath);
      }
    } else if (chunk.type === 'web-preview') {
      if (typeof chunk.html === 'string') {
        const store = useChatStore.getState();
        store.setWebPreviewHtml(chunk.html);
        if (typeof chunk.file === 'string') {
          store.setWebPreviewFile(chunk.file);
        }
      }
    } else if (chunk.type === 'error') {
      cancelRaf(sid);
      flushBuffer(sid);
      buffersRef.current.delete(sid);
      setStreaming(false);
      if (targetSessionRef.current === sid) {
        targetSessionRef.current = null;
      }
      setErrorMsg(chunk.message);
    }
  };

  return handleChunk;
}
