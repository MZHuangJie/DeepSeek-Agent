import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useModelStore } from '../../stores/model';
import { useAgentStore } from '../../stores/agent';
import { useLayoutStore } from '../../stores/layout';
import { useFilesStore } from '../../stores/files';
import { useModeStore } from '../../stores/mode';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ConfirmDialog from './ConfirmDialog';
import { Command } from '../../commands';

export default function ChatPanel() {
  const { sessions, activeSessionId, isStreaming, addMessage, setStreaming, updateLastAssistant, newAssistantMessage, loadSessions } = useChatStore();
  const { loadModels, getActiveModel, loadImageModel } = useModelStore();
  const { currentWorkspace, loadWorkspace } = useFilesStore();
  const { setBottomClosed, setBottomExpanded } = useLayoutStore();
  const agentStore = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [scrollBtnHover, setScrollBtnHover] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmReq, setConfirmReq] = useState<{ confirmId: string; name: string } | null>(null);
  const autoApprovedRef = useRef<Set<string>>(new Set());
  const currentStepRef = useRef(0);
  // RAF 批量更新 buffer，避免每个 IPC chunk 都触发 React 重渲染
  const pendingContentRef = useRef<string | null>(null);
  const pendingThinkingRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  function flushRafBuffer() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    const pc = pendingContentRef.current;
    const pt = pendingThinkingRef.current;
    pendingContentRef.current = null;
    pendingThinkingRef.current = null;
    if (pc !== null || pt !== null) {
      const upd: any = {};
      if (pc !== null) upd.content = pc;
      if (pt !== null) upd.thinkingContent = pt;
      useChatStore.getState().updateLastAssistant(upd);
    }
  }
  // 组件卸载时清理
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const projectDir = currentWorkspace || '';

  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight <= 100) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load API key & project dir & models & sessions on mount
  useEffect(() => {
    (async () => {
      await loadModels();
      await loadImageModel();
      await loadSessions();
      // 加载完会话后，如果没有历史会话，创建一个新的
      const { sessions, activeSessionId } = useChatStore.getState();
      if (sessions.length === 0 && !activeSessionId) {
        useChatStore.getState().createSession();
      }
      const key = await window.api.settings.getApiKey();
      if (key) setApiKey(key);
      else setShowKeyInput(true);
      await loadWorkspace();
    })();
  }, []);

  // Listen to agent stream chunks
  useEffect(() => {
    const unsubscribe = window.api.agent.onStreamChunk((chunk: any) => {
      const { sessions, activeSessionId, updateLastAssistant: update, setStreaming: setStream } = useChatStore.getState();
      const sess = sessions.find(s => s.id === activeSessionId);
      const lastMsg = sess?.messages.at(-1);

      if (chunk.type === 'content') {
        const step = chunk.step || 1;
        if (step > currentStepRef.current) {
          currentStepRef.current = step;
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          pendingContentRef.current = null;
          pendingThinkingRef.current = null;
          useChatStore.getState().newAssistantMessage();
        }
        pendingContentRef.current = (pendingContentRef.current ?? lastMsg?.content ?? '') + chunk.text;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const text = pendingContentRef.current;
            pendingContentRef.current = null;
            if (text !== null) useChatStore.getState().updateLastAssistant({ content: text });
          });
        }
      } else if (chunk.type === 'thinking') {
        const step = chunk.step || 0;
        if (step > 0 && step > currentStepRef.current) {
          currentStepRef.current = step;
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          pendingContentRef.current = null;
          pendingThinkingRef.current = null;
          useChatStore.getState().newAssistantMessage();
        }
        pendingThinkingRef.current = (pendingThinkingRef.current ?? lastMsg?.thinkingContent ?? '') + chunk.text;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const text = pendingContentRef.current;
            const thinking = pendingThinkingRef.current;
            pendingContentRef.current = null;
            pendingThinkingRef.current = null;
            if (text !== null || thinking !== null) {
              const upd: any = {};
              if (text !== null) upd.content = text;
              if (thinking !== null) upd.thinkingContent = thinking;
              useChatStore.getState().updateLastAssistant(upd);
            }
          });
        }
      } else if (chunk.type === 'tool-call') {
        const step = chunk.step || 1;
        if (step > currentStepRef.current) {
          currentStepRef.current = step;
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          pendingContentRef.current = null;
          pendingThinkingRef.current = null;
          useChatStore.getState().newAssistantMessage();
        }
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(chunk.args || '{}'); } catch { parsedArgs = { _raw: chunk.args }; }
        const current = lastMsg?.toolCalls ?? [];
        update({
          toolCalls: [
            ...current,
            { name: chunk.name, args: parsedArgs, status: 'running', timestamp: Date.now() },
          ],
        });
        const agentStore = useAgentStore.getState();
        agentStore.addToolCall({
          id: `tc-${Date.now()}`,
          name: chunk.name,
          args: chunk.args || '{}',
          status: 'running',
          timestamp: Date.now(),
        });
      } else if (chunk.type === 'tool-result') {
        const current = lastMsg?.toolCalls ?? [];
        // 从后往前找第一个 status==='running' 且 name 匹配的 tool call
        const matchedIdx = current.reduceRight((found: number, tc: any, idx: number) => {
          if (found >= 0) return found;
          if (tc.status === 'running' && tc.name === chunk.name) return idx;
          return -1;
        }, -1);
        const targetIdx = matchedIdx >= 0 ? matchedIdx : current.length - 1;
        update({
          toolCalls: current.map((tc: any, idx: number) =>
            idx === targetIdx
              ? { ...tc, result: chunk.result, status: chunk.status }
              : tc
          ),
        });
        const agentStore = useAgentStore.getState();
        const lastTc = agentStore.toolCalls[agentStore.toolCalls.length - 1];
        if (lastTc) {
          agentStore.updateToolCall(lastTc.id, {
            result: chunk.result,
            status: chunk.status,
          });
        }
      } else if (chunk.type === 'usage') {
        const agentStore = useAgentStore.getState();
        agentStore.setTokenStats({
          total: chunk.total,
          prompt: chunk.prompt,
          completion: chunk.completion,
          toolTokens: chunk.toolTokens ?? 0,
          contextWindow: chunk.currentPrompt || chunk.prompt || 0,
          contextMax: chunk.contextMax || 100000,
          cost: parseFloat((chunk.total * 0.000002).toFixed(3)),
        });
      } else if (chunk.type === 'explore-progress') {
        const agentStore = useAgentStore.getState();
        agentStore.setCurrentStep({
          step: chunk.step || 1,
          total: chunk.total || 1,
          description: `正在读取项目文件，已读取 ${chunk.readFileCount}/${chunk.totalFiles} 个文件`,
          progress: Math.min(99, chunk.readPercentage || 0),
          readPercentage: chunk.readPercentage,
          readFileCount: chunk.readFileCount,
          totalFiles: chunk.totalFiles,
        });
      } else if (chunk.type === 'done') {
        flushRafBuffer();
        setStream(false);
        const agentStore = useAgentStore.getState();
        const current = agentStore.currentStep;
        // 探索模式下保留完成状态，其他模式清空
        if (current?.readPercentage !== undefined) {
          agentStore.setCurrentStep({
            step: current?.step || 1,
            total: current?.total || 1,
            description: '已完成',
            progress: 100,
            readPercentage: current?.readPercentage,
            readFileCount: current?.readFileCount,
            totalFiles: current?.totalFiles,
          });
        } else {
          agentStore.setCurrentStep(null);
        }
      } else if (chunk.type === 'sub-agent-start') {
        const agentStore = useAgentStore.getState();
        agentStore.addSubAgent({
          id: chunk.taskId,
          type: chunk.subAgentType,
          targetPath: chunk.targetPath || '',
          status: 'running',
          filesProcessed: 0,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          findings: [],
          startTime: Date.now(),
        });
      } else if (chunk.type === 'sub-agent-tool-call') {
        const agentStore = useAgentStore.getState();
        const sa = agentStore.subAgents.find(s => s.id === chunk.taskId);
        if (sa && chunk.name === 'read_file') {
          agentStore.updateSubAgent(chunk.taskId, {
            filesProcessed: sa.filesProcessed + 1,
          });
        }
      } else if (chunk.type === 'sub-agent-usage') {
        const agentStore = useAgentStore.getState();
        agentStore.updateSubAgent(chunk.taskId, {
          tokenUsage: {
            prompt: chunk.prompt,
            completion: chunk.completion,
            total: chunk.total,
          },
        });
      } else if (chunk.type === 'sub-agent-complete') {
        const agentStore = useAgentStore.getState();
        agentStore.updateSubAgent(chunk.taskId, {
          status: chunk.success ? 'completed' : 'failed',
          summary: chunk.summary,
          filesProcessed: chunk.filesProcessed ?? 0,
          tokenUsage: chunk.tokenUsage ?? { prompt: 0, completion: 0, total: 0 },
          endTime: Date.now(),
        });
      } else if (chunk.type === 'sub-agent-error') {
        const agentStore = useAgentStore.getState();
        agentStore.updateSubAgent(chunk.taskId, {
          status: 'failed',
          error: chunk.error,
          endTime: Date.now(),
        });
      } else if (chunk.type === 'error') {
        flushRafBuffer();
        setStream(false);
        setErrorMsg(chunk.message);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  // Listen for confirm requests from agent
  useEffect(() => {
    const unsubscribe = window.api.agent.onConfirmRequest((req) => {
      if (autoApprovedRef.current.has(req.name)) {
        // 已自动允许，直接回复
        window.api.agent.confirmResponse(req.confirmId, true);
      } else {
        setConfirmReq(req);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    await window.api.settings.setApiKey(apiKey.trim());
    setErrorMsg('');
    setShowKeyInput(false);
  };

  const handleStop = useCallback(async () => {
    await window.api.agent.cancel();
    setStreaming(false);
  }, []);

  const handleSend = useCallback(async (content: string, command?: Command) => {
    if (!activeSessionId) return;
    if (!apiKey) { setShowKeyInput(true); return; }
    setErrorMsg('');

    const totalChars = messages.reduce((sum, m) => sum + m.content.length + (m.thinkingContent?.length ?? 0), 0);

    const displayContent = command ? `/${command.name} ${content}` : content;

    // 截断 tool result 中的 base64 图片数据，避免历史消息膨胀
    function truncateToolResult(result: string): string {
      if (typeof result !== 'string') return result;
      // 匹配 data:image/xxx;base64, 后跟大量 base64 字符
      const base64Regex = /data:image\/\w+;base64,[A-Za-z0-9+/=]{500,}/g;
      if (!base64Regex.test(result)) return result;
      base64Regex.lastIndex = 0;
      return result.replace(base64Regex, (match) =>
        match.slice(0, 80) + `...[base64数据已截断，原长度${match.length}字符]`
      );
    }

    const history: any[] = [];
    for (const m of messages) {
      const entry: any = { role: m.role, content: m.content };
      if (m.role === 'assistant' && m.thinkingContent) {
        entry.reasoning_content = m.thinkingContent;
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        // 只保留有 result 的 tool call（兼容旧数据中因 bug 缺失 result 的记录）
        const validCalls = m.toolCalls.filter(tc => tc.result !== undefined);
        if (validCalls.length > 0) {
          entry.tool_calls = validCalls.map(tc => ({
            id: `call_${tc.timestamp}`,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          }));
        }
      }
      history.push(entry);
      // 每个带 tool_calls 的 assistant 消息后必须跟随 tool 消息
      if (entry.tool_calls && entry.tool_calls.length > 0) {
        for (const tc of (m.toolCalls ?? [])) {
          if (tc.result !== undefined) {
            history.push({
              role: 'tool',
              tool_call_id: `call_${tc.timestamp}`,
              content: truncateToolResult(tc.result),
            });
          }
        }
      }
    }

    agentStore.reset();
    currentStepRef.current = 1;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingContentRef.current = null;
    pendingThinkingRef.current = null;
    addMessage({ id: `msg-${Date.now()}`, role: 'user', content: displayContent, timestamp: Date.now() });
    const assistantId = `msg-${Date.now() + 1}`;
    addMessage({ id: assistantId, role: 'assistant', content: '', timestamp: Date.now() });
    setStreaming(true);

    const modelConfig = getActiveModel();
    const mode = useModeStore.getState().mode;
    try {
      await window.api.agent.send({
        messages: history,
        apiKey,
        projectDir,
        newMessage: content || displayContent,
        model: modelConfig.model,
        baseUrl: modelConfig.baseUrl,
        contextMax: modelConfig.contextWindow || 64000,
        commandPrompt: command?.systemPrompt,
        mode,
      });
    } catch (err: any) {
      setStreaming(false);
      setErrorMsg(err.message || '请求失败');
    }
  }, [activeSessionId, apiKey, projectDir, messages, addMessage, setStreaming]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', padding: '12px 16px', position: 'relative' }}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) {
            setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
          }
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <div style={{ marginBottom: 12 }}><img src="/assets/logo.png" alt="ai" style={{ width: 48, height: 44 }} /></div>
            <div style={{ fontSize: 14 }}>开始与 DeepSeek Agent 对话</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>输入消息或 @ 引用文件</div>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        {isStreaming && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 0' }}>
            <span style={{ animation: 'pulse 1s infinite' }}><img src="/assets/8.png" alt="thinking" style={{ width: 16, height: 16 }} /></span>
            <span>思考中...</span>
          </div>
        )}
        <div ref={endRef} />
        {showScrollDown && (
          <div
            onClick={() => {
              endRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            onMouseEnter={() => setScrollBtnHover(true)}
            onMouseLeave={() => setScrollBtnHover(false)}
            style={{
              position: 'sticky', bottom: 8, float: 'right',
              width: 32, height: 32, borderRadius: '50%',
              background: scrollBtnHover ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: scrollBtnHover ? '1px solid var(--accent)' : '1px solid var(--border)',
              boxShadow: scrollBtnHover ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transform: scrollBtnHover ? 'translateY(-1px)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: 0.85,
              transition: 'all 0.2s',
            }}
            title="回到底部"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v8M4 8l4 4 4-4" stroke={scrollBtnHover ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {(showKeyInput || errorMsg) && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {showKeyInput && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: errorMsg ? 8 : 0 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>API Key:</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                placeholder="输入 DeepSeek API Key"
                style={{
                  flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text-primary)', padding: '4px 8px', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={handleSaveKey}
                style={{
                  background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 4,
                  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                }}
              >
                保存
              </button>
            </div>
          )}
          {errorMsg && (
            <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 4 }}>{errorMsg}</div>
          )}
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isStreaming} isStreaming={isStreaming} onStop={handleStop} />

      {confirmReq && (
        <ConfirmDialog
          name={confirmReq.name}
          onApprove={(alwaysAllow) => {
            if (alwaysAllow) autoApprovedRef.current.add(confirmReq.name);
            window.api.agent.confirmResponse(confirmReq.confirmId, true);
            setConfirmReq(null);
          }}
          onDeny={() => {
            window.api.agent.confirmResponse(confirmReq.confirmId, false);
            setConfirmReq(null);
          }}
        />
      )}
    </div>
  );
}
