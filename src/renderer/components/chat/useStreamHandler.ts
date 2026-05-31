import { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chat';
import { useAgentStore } from '../../stores/agent';
import { buildToolActivity, computeSubAgentProgress, isUsefulSubAgentSnippet } from './subAgentUi';
import { summarizeSessionTitleIfNeeded } from '../../utils/sessionTitleSummarize';

interface StreamHandlerDeps {
  currentStepRef: React.MutableRefObject<number>;
  totalContentRef: React.MutableRefObject<string>;
  totalThinkingRef: React.MutableRefObject<string>;
  pendingContentRef: React.MutableRefObject<string>;
  pendingThinkingRef: React.MutableRefObject<string>;
  flushRafBuffer: () => void;
  setStreaming: (v: boolean) => void;
  setErrorMsg: (msg: string) => void;
  onDone?: () => void;
}

export function useStreamHandler(deps: StreamHandlerDeps) {
  const { currentStepRef, totalContentRef, totalThinkingRef, pendingContentRef, pendingThinkingRef, flushRafBuffer, setStreaming, setErrorMsg, onDone } = deps;
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const scheduleRaf = () => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => { rafRef.current = null; flushRafBuffer(); });
    }
  };

  const handleChunk = (chunk: any) => {
    const { sessions, activeSessionId, updateLastAssistant, webPreviewHtml } = useChatStore.getState();
    const sess = sessions.find(s => s.id === activeSessionId);
    const lastMsg = sess?.messages.at(-1);
    const hasWebPreview = !!webPreviewHtml;

    if (chunk.type === 'content') {
      const step = chunk.step || 1;
      if (step > currentStepRef.current && !hasWebPreview) {
        currentStepRef.current = step;
        flushRafBuffer();
        totalContentRef.current = '';
        totalThinkingRef.current = '';
        pendingContentRef.current = '';
        pendingThinkingRef.current = '';
        useChatStore.getState().newAssistantMessage();
      }
      if (!hasWebPreview) {
        pendingContentRef.current += chunk.text;
      }
      scheduleRaf();
    } else if (chunk.type === 'thinking') {
      const step = chunk.step || 0;
      if (step > 0 && step > currentStepRef.current && !hasWebPreview) {
        currentStepRef.current = step;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        pendingContentRef.current = '';
        pendingThinkingRef.current = '';
        totalContentRef.current = '';
        totalThinkingRef.current = '';
        useChatStore.getState().newAssistantMessage();
      }
      pendingThinkingRef.current += chunk.text;
      scheduleRaf();
    } else if (chunk.type === 'tool-call') {
      const step = chunk.step || 1;
      if (step > currentStepRef.current && !hasWebPreview) {
        currentStepRef.current = step;
        flushRafBuffer();
        totalContentRef.current = '';
        totalThinkingRef.current = '';
        pendingContentRef.current = '';
        pendingThinkingRef.current = '';
        useChatStore.getState().newAssistantMessage();
      }
      let parsedArgs: Record<string, unknown> = {};
      try { parsedArgs = JSON.parse(chunk.args || '{}'); } catch { parsedArgs = { _raw: chunk.args }; }
      const current = lastMsg?.toolCalls ?? [];
      updateLastAssistant({
        toolCalls: [...current, { name: chunk.name, args: parsedArgs, status: 'running', timestamp: Date.now() }],
      });
      useAgentStore.getState().addToolCall({
        id: `tc-${Date.now()}`, name: chunk.name, args: chunk.args || '{}', status: 'running', timestamp: Date.now(),
      });
    } else if (chunk.type === 'tool-result') {
      const current = lastMsg?.toolCalls ?? [];
      const matchedIdx = current.reduceRight((found: number, tc: any, idx: number) => {
        if (found >= 0) return found;
        if (tc.status === 'running' && tc.name === chunk.name) return idx;
        return -1;
      }, -1);
      const targetIdx = matchedIdx >= 0 ? matchedIdx : current.length - 1;
      updateLastAssistant({
        toolCalls: current.map((tc: any, idx: number) =>
          idx === targetIdx ? { ...tc, result: chunk.result, status: chunk.status } : tc
        ),
      });
      const lastTc = useAgentStore.getState().toolCalls[useAgentStore.getState().toolCalls.length - 1];
      if (lastTc) useAgentStore.getState().updateToolCall(lastTc.id, { result: chunk.result, status: chunk.status });
    } else if (chunk.type === 'usage') {
      useAgentStore.getState().setMainTokenStats({
        total: chunk.total, prompt: chunk.prompt, completion: chunk.completion,
        toolTokens: chunk.toolTokens ?? 0, contextWindow: chunk.currentPrompt || chunk.prompt || 0,
        contextMax: chunk.contextMax || 100000, cost: parseFloat((chunk.total * 0.000002).toFixed(3)),
      });
    } else if (chunk.type === 'done') {
      flushRafBuffer();
      totalContentRef.current = '';
      totalThinkingRef.current = '';
      setStreaming(false);
      const current = useAgentStore.getState().currentStep;
      useAgentStore.getState().setCurrentStep({
        step: current?.step || 1, total: current?.total || 1, description: '已完成', progress: 100,
      });
      if (activeSessionId) {
        void summarizeSessionTitleIfNeeded(activeSessionId);
      }
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
        totalFiles: chunk.totalFiles, step: chunk.step, total: chunk.total,
      });
    } else if (chunk.type === 'explore-warning') {
      const prev = useAgentStore.getState().exploreProgress;
      if (prev) useAgentStore.getState().setExploreProgress({ ...prev, warning: chunk.warning });
    } else if (chunk.type === 'sub-agent-start') {
      useAgentStore.getState().addSubAgent({
        id: chunk.taskId,
        type: chunk.subAgentType,
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
      setStreaming(false);
      setErrorMsg(chunk.message);
    }
  };

  return handleChunk;
}