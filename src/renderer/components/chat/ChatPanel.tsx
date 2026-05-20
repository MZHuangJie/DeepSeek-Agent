import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useModelStore } from '../../stores/model';
import { useAgentStore } from '../../stores/agent';
import { useFilesStore } from '../../stores/files';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ConfirmDialog from './ConfirmDialog';
import { Command } from '../../commands';

export default function ChatPanel() {
  const { sessions, activeSessionId, isStreaming, addMessage, setStreaming, updateLastAssistant, loadSessions } = useChatStore();
  const { loadModels, getActiveModel } = useModelStore();
  const { currentWorkspace, loadWorkspace } = useFilesStore();
  const agentStore = useAgentStore();
  const endRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmReq, setConfirmReq] = useState<{ confirmId: string; name: string } | null>(null);
  const autoApprovedRef = useRef<Set<string>>(new Set());

  const projectDir = currentWorkspace || '';

  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages ?? [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load API key & project dir & models & sessions on mount
  useEffect(() => {
    (async () => {
      await loadModels();
      await loadSessions();
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
        update({ content: (lastMsg?.content ?? '') + chunk.text });
        const agentStore = useAgentStore.getState();
        const step = chunk.step || 1;
        const total = chunk.total || 1;
        agentStore.setCurrentStep({
          step,
          total,
          description: (lastMsg?.content ?? '') + chunk.text,
          progress: Math.min(99, Math.round((step / total) * 100)),
        });
      } else if (chunk.type === 'thinking') {
        update({ thinkingContent: (lastMsg?.thinkingContent ?? '') + chunk.text });
      } else if (chunk.type === 'tool-call') {
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
        agentStore.setCurrentStep({
          step: chunk.step || 1,
          total: chunk.total || 1,
          description: `正在调用工具: ${chunk.name}`,
          progress: chunk.total ? Math.min(99, Math.round(((chunk.step || 1) / chunk.total) * 100)) : 70,
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
          toolTokens: 0,
          contextWindow: chunk.currentPrompt || chunk.prompt || 0,
          contextMax: chunk.contextMax || 100000,
          cost: parseFloat((chunk.total * 0.000002).toFixed(3)),
        });
      } else if (chunk.type === 'done') {
        setStream(false);
        const agentStore = useAgentStore.getState();
        const current = agentStore.currentStep;
        agentStore.setCurrentStep({
          step: current?.step || 1,
          total: current?.total || 1,
          description: '已完成',
          progress: 100,
        });
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

    const displayContent = command ? `/${command.name} ${content}` : content;
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
              content: tc.result,
            });
          }
        }
      }
    }

    agentStore.reset();
    addMessage({ id: `msg-${Date.now()}`, role: 'user', content: displayContent, timestamp: Date.now() });
    const assistantId = `msg-${Date.now() + 1}`;
    addMessage({ id: assistantId, role: 'assistant', content: '', timestamp: Date.now() });
    setStreaming(true);

    const modelConfig = getActiveModel();
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
      });
    } catch (err: any) {
      setStreaming(false);
      setErrorMsg(err.message || '请求失败');
    }
  }, [activeSessionId, apiKey, projectDir, messages, addMessage, setStreaming]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
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
