import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore } from '../../stores/chat';
import { useModelStore, PROVIDERS } from '../../stores/model';
import { useAgentStore } from '../../stores/agent';
import { useLayoutStore } from '../../stores/layout';
import { useFilesStore } from '../../stores/files';
import { useModeStore } from '../../stores/mode';
import { useRoleplayStore } from '../../stores/roleplay';
import { buildCharacterPrompt, getEffectiveStatusFields, getTemplateById, ROLEPLAY_OPENING_USER_MESSAGE, ROLEPLAY_STATUS_RETRY_MESSAGE } from '../../utils/roleplay';
import { parseRoleplayResponse, formatRoleplayMessageForHistory, shouldRetryRoleplayStatus } from '../../utils/parseRoleplayResponse';
import MessageBubble from './MessageBubble';
import ChatInput, { PastedImage } from './ChatInput';
import ConfirmDialog from './ConfirmDialog';
import ChoiceDialog from './ChoiceDialog';
import { Command } from '../../commands';
import { useStreamHandler } from './useStreamHandler';
import shared from '../../styles/components.module.css';
import styles from './ChatPanel.module.css';

export default function ChatPanel() {
  const { sessions, activeSessionId, isStreaming, addMessage, setStreaming, updateLastAssistant, newAssistantMessage, loadSessions } = useChatStore();
  const { loadModels, getActiveModel, loadImageModel, loadVisionModel } = useModelStore();
  const { currentWorkspace, loadWorkspace } = useFilesStore();
  const { setBottomClosed, setBottomExpanded } = useLayoutStore();
  const agentStore = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmReq, setConfirmReq] = useState<{ confirmId: string; name: string; args?: string } | null>(null);
  const [choiceReq, setChoiceReq] = useState<{ choiceId: string; message: string; choices: Array<{ label: string; description?: string }> } | null>(null);
  const autoApprovedRef = useRef<Set<string>>(new Set());
  const statusRetryUsedRef = useRef(false);
  const currentStepRef = useRef(0);
  const totalContentRef = useRef('');
  const totalThinkingRef = useRef('');
  const pendingContentRef = useRef('');
  const pendingThinkingRef = useRef('');
  function flushRafBuffer() {
    if (pendingContentRef.current || pendingThinkingRef.current) {
      totalContentRef.current += pendingContentRef.current;
      totalThinkingRef.current += pendingThinkingRef.current;
      pendingContentRef.current = '';
      pendingThinkingRef.current = '';
      const upd: Partial<import('../../stores/chat').Message> = {};
      if (totalThinkingRef.current) upd.thinkingContent = totalThinkingRef.current;

      const mode = useModeStore.getState().mode;
      if (totalContentRef.current) {
        if (mode === 'roleplay') {
          const raw = totalContentRef.current;
          const parsed = parseRoleplayResponse(raw);
          upd.content = parsed.reply || raw.replace(/<status>[\s\S]*$/i, '').replace(/<\/?reply>/gi, '').trim() || raw;
          upd.rawContent = raw;
          if (parsed.status && parsed.statusComplete) {
            upd.roleplayMeta = { status: parsed.status, statusComplete: true };
          } else if (parsed.status) {
            upd.roleplayMeta = { status: parsed.status, statusComplete: false };
          }
        } else {
          upd.content = totalContentRef.current;
        }
      }

      useChatStore.getState().updateLastAssistant(upd);
    }
  }

  const projectDir = currentWorkspace || '';

  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages ?? [];
  const mode = useModeStore(s => s.mode);

  useEffect(() => {
    if (isAtBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    (async () => {
      await loadModels();
      await loadImageModel();
      await loadVisionModel();
      await loadSessions();
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

  const buildHistory = useCallback((sourceMessages: typeof messages) => {
    function truncateToolResult(result: string): string {
      if (typeof result !== 'string') return result;
      const base64Regex = /data:image\/\w+;base64,[A-Za-z0-9+/=]{500,}/g;
      if (!base64Regex.test(result)) return result;
      base64Regex.lastIndex = 0;
      return result.replace(base64Regex, (match) =>
        match.slice(0, 80) + `...[base64数据已截断，原长度${match.length}字符]`
      );
    }

    const sendMode = useModeStore.getState().mode;
    const history: any[] = [];
    for (const m of sourceMessages) {
      let messageContent: string | typeof m.contentParts = m.content;
      if (m.role === 'user' && m.contentParts?.length) {
        messageContent = m.contentParts;
      } else if (sendMode === 'roleplay' && m.role === 'assistant' && m.roleplayMeta?.status) {
        messageContent = formatRoleplayMessageForHistory(m.content, m.roleplayMeta.status);
      }
      const entry: any = {
        role: m.role,
        content: messageContent,
      };
      if (m.role === 'assistant' && m.thinkingContent) {
        entry.reasoning_content = m.thinkingContent;
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
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
    return history;
  }, []);

  const resetStreamBuffers = useCallback(() => {
    agentStore.reset();
    currentStepRef.current = 1;
    pendingContentRef.current = '';
    pendingThinkingRef.current = '';
    totalContentRef.current = '';
    totalThinkingRef.current = '';
    isAtBottomRef.current = true;
  }, [agentStore]);

  const invokeAgent = useCallback(async (opts: {
    history: any[];
    newMessage: string;
    commandPrompt?: string;
  }) => {
    const modelConfig = getActiveModel();
    const sendMode = useModeStore.getState().mode;
    const effectiveApiKey = modelConfig.apiKey || apiKey;
    await window.api.agent.send({
      messages: opts.history,
      apiKey: effectiveApiKey,
      projectDir,
      newMessage: opts.newMessage,
      model: modelConfig.model,
      baseUrl: modelConfig.baseUrl,
      contextMax: modelConfig.contextWindow || 64000,
      commandPrompt: opts.commandPrompt,
      mode: sendMode,
      providerMultimodal: PROVIDERS[modelConfig.provider]?.multimodal ?? false,
    });
  }, [apiKey, projectDir, getActiveModel]);

  const sendRoleplayStatusRetry = useCallback(async () => {
    if (!activeSessionId || !apiKey || statusRetryUsedRef.current) return;
    if (useModeStore.getState().mode !== 'roleplay') return;

    const chat = useChatStore.getState();
    const target = chat.sessions.find(s => s.id === activeSessionId);
    const last = target?.messages.at(-1);
    if (!last || last.role !== 'assistant') return;

    const activeCharacter = useRoleplayStore.getState().getActiveCharacter();
    if (!activeCharacter) return;
    const templates = useRoleplayStore.getState().templates;
    const template = getTemplateById(templates, activeCharacter.templateId);
    const expectsStatus = getEffectiveStatusFields(activeCharacter, template).length > 0;
    const raw = last.rawContent || last.content;
    if (!shouldRetryRoleplayStatus(raw, expectsStatus)) return;

    statusRetryUsedRef.current = true;
    resetStreamBuffers();
    updateLastAssistant({
      content: '',
      rawContent: undefined,
      roleplayMeta: undefined,
      thinkingContent: undefined,
      toolCalls: undefined,
    });
    setStreaming(true);

    const priorMessages = target.messages.slice(0, -1);
    const history = buildHistory(priorMessages);
    const commandPrompt = buildCharacterPrompt(activeCharacter, template);

    try {
      await invokeAgent({
        history,
        newMessage: ROLEPLAY_STATUS_RETRY_MESSAGE,
        commandPrompt,
      });
    } catch (err: unknown) {
      setStreaming(false);
      setErrorMsg(err instanceof Error ? err.message : '状态补全失败');
    }
  }, [activeSessionId, apiKey, resetStreamBuffers, updateLastAssistant, setStreaming, buildHistory, invokeAgent]);

  const handleStreamChunk = useStreamHandler({
    currentStepRef, totalContentRef, totalThinkingRef,
    pendingContentRef, pendingThinkingRef, flushRafBuffer,
    setStreaming: (v) => useChatStore.getState().setStreaming(v),
    setErrorMsg,
    onDone: () => { void sendRoleplayStatusRetry(); },
  });

  useEffect(() => {
    const unsubscribe = window.api.agent.onStreamChunk(handleStreamChunk);
    return () => { unsubscribe(); };
  }, [handleStreamChunk]);

  useEffect(() => {
    const unsubscribe = window.api.agent.onConfirmRequest((req) => {
      if (autoApprovedRef.current.has(req.name)) {
        window.api.agent.confirmResponse(req.confirmId, true);
      } else {
        setConfirmReq(req);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const unsubscribe = window.api.agent.onChoiceRequest((req) => {
      setChoiceReq(req);
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

  const sendRoleplayOpening = useCallback(async (sessionId: string) => {
    if (!apiKey) return;
    const chat = useChatStore.getState();
    const target = chat.sessions.find(s => s.id === sessionId);
    if (!target?.pendingOpening || target.messages.length > 0) return;
    if (useModeStore.getState().mode !== 'roleplay') {
      chat.clearPendingOpening(sessionId);
      return;
    }

    const activeCharacter = useRoleplayStore.getState().getActiveCharacter();
    if (!activeCharacter) {
      chat.clearPendingOpening(sessionId);
      return;
    }

    chat.clearPendingOpening(sessionId);
    statusRetryUsedRef.current = false;
    resetStreamBuffers();
    addMessage({ id: `msg-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() });
    setStreaming(true);

    const templates = useRoleplayStore.getState().templates;
    const template = getTemplateById(templates, activeCharacter.templateId);
    const commandPrompt = buildCharacterPrompt(activeCharacter, template, { forOpening: true });

    try {
      await invokeAgent({
        history: [],
        newMessage: ROLEPLAY_OPENING_USER_MESSAGE,
        commandPrompt,
      });
    } catch (err: unknown) {
      setStreaming(false);
      setErrorMsg(err instanceof Error ? err.message : '开场生成失败');
    }
  }, [apiKey, resetStreamBuffers, addMessage, setStreaming, invokeAgent]);

  useEffect(() => {
    if (!activeSessionId || isStreaming || !apiKey) return;
    const target = sessions.find(s => s.id === activeSessionId);
    if (!target?.pendingOpening || target.messages.length > 0) return;
    if (mode !== 'roleplay') return;
    void sendRoleplayOpening(activeSessionId);
  }, [activeSessionId, sessions, isStreaming, apiKey, mode, sendRoleplayOpening]);

  const handleSend = useCallback(async (content: string, command?: Command, images?: PastedImage[]) => {
    if (!activeSessionId) return;
    if (!apiKey) { setShowKeyInput(true); return; }
    setErrorMsg('');
    statusRetryUsedRef.current = false;

    const displayContent = command ? `/${command.name} ${content}` : content;
    const hasImages = images && images.length > 0;

    const history = buildHistory(messages);
    resetStreamBuffers();

    const modelConfig = getActiveModel();
    const providerSupportsVision = PROVIDERS[modelConfig.provider]?.multimodal ?? false;
    const imageMarkdown = hasImages ? '\n' + images!.map(im => `![image](${im.path})`).join('\n') : '';
    const storedContent = (displayContent || (hasImages ? '（图片）' : '')) + imageMarkdown;
    const contentParts = (hasImages && providerSupportsVision)
      ? [
          { type: 'text' as const, text: content || displayContent || '请描述这张图片' },
          ...images!.map(im => ({ type: 'image_url' as const, image_url: { url: im.dataUrl } })),
        ]
      : undefined;
    addMessage({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: storedContent,
      contentParts,
      timestamp: Date.now(),
    });
    const assistantId = `msg-${Date.now() + 1}`;
    addMessage({ id: assistantId, role: 'assistant', content: '', timestamp: Date.now() });
    setStreaming(true);

    const sendMode = useModeStore.getState().mode;
    const activeCharacter = sendMode === 'roleplay' ? useRoleplayStore.getState().getActiveCharacter() : null;
    let commandPrompt = command?.systemPrompt;
    if (sendMode === 'roleplay' && activeCharacter) {
      const templates = useRoleplayStore.getState().templates;
      const template = getTemplateById(templates, activeCharacter.templateId);
      const characterPrompt = buildCharacterPrompt(activeCharacter, template);
      commandPrompt = commandPrompt ? `${characterPrompt}\n\n${commandPrompt}` : characterPrompt;
    }
    const userText = content || displayContent || (hasImages ? '请描述这张图片' : '');
    const textContent = userText + (providerSupportsVision ? '' : imageMarkdown);
    const newMessage = contentParts ?? textContent;

    try {
      await invokeAgent({ history, newMessage, commandPrompt });
    } catch (err: unknown) {
      setStreaming(false);
      setErrorMsg(err instanceof Error ? err.message : '请求失败');
    }
  }, [activeSessionId, apiKey, messages, addMessage, setStreaming, buildHistory, resetStreamBuffers, invokeAgent, getActiveModel]);

  return (
    <div className={styles.container}>
      <div
        ref={scrollRef}
        className={styles.scrollArea}
        data-chat-scroll="true"
        onScroll={() => {
          const el = scrollRef.current;
          if (el) {
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            isAtBottomRef.current = distFromBottom < 50;
            setShowScrollDown(distFromBottom > 100);
          }
        }}
      >
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyLogo}><img src="/assets/logo.png" alt="ai" className={styles.emptyLogoImg} /></div>
            {mode === 'roleplay' && session?.pendingOpening ? (
              <>
                <div className={styles.emptyTitle}>{isStreaming ? '正在生成开场…' : apiKey ? '即将开始角色扮演' : '请先配置 API Key'}</div>
                <div className={styles.emptyHint}>
                  {isStreaming ? '模型正在根据开场故事撰写第一条消息' : apiKey ? '角色将先发送开场白，之后由你回复' : '保存 API Key 后将自动生成开场'}
                </div>
              </>
            ) : (
              <>
                <div className={styles.emptyTitle}>开始与 DeepSeek Agent 对话</div>
                <div className={styles.emptyHint}>输入消息或 @ 引用文件</div>
              </>
            )}
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
        {isStreaming && (
          <div className={styles.thinkingHint}>
            <span className={styles.thinkingIcon}><img src="/assets/8.png" alt="thinking" className={styles.thinkingIconImg} /></span>
            <span>思考中...</span>
          </div>
        )}
        <div ref={endRef} />
        {showScrollDown && (
          <div className={shared.scrollDownBtn} onClick={() => endRef.current?.scrollIntoView({ behavior: 'smooth' })} title="回到底部">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path className={shared.scrollArrow} d="M8 3v8M4 8l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {(showKeyInput || errorMsg) && (
        <div className={styles.apiBar}>
          {showKeyInput && (
            <div className={`${styles.apiRow} ${errorMsg ? styles.apiRowWithError : ''}`}>
              <span className={styles.apiLabel}>API Key:</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                placeholder="输入 DeepSeek API Key"
                className={styles.apiInput}
              />
              <button onClick={handleSaveKey} className={styles.apiSaveBtn}>
                保存
              </button>
            </div>
          )}
          {errorMsg && (
            <div className={styles.errorMsg}>{errorMsg}</div>
          )}
        </div>
      )}

      <div className={styles.inputWrap}>
        {choiceReq && (
          <ChoiceDialog
            message={choiceReq.message}
            choices={choiceReq.choices}
            onConfirm={(selected, feedback) => {
              window.api.agent.choiceResponse(choiceReq.choiceId, selected, feedback, false);
              setChoiceReq(null);
            }}
            onCancel={() => {
              window.api.agent.choiceResponse(choiceReq.choiceId, [], '', true);
              setChoiceReq(null);
            }}
          />
        )}
        {confirmReq && (
          <ConfirmDialog
            name={confirmReq.name}
            args={confirmReq.args}
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
        <ChatInput onSend={handleSend} disabled={isStreaming} isStreaming={isStreaming} onStop={handleStop} />
      </div>
    </div>
  );
}
