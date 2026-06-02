import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useChatStore, type RoleplayMessageMeta } from '../../stores/chat';
import { useModelStore, PROVIDERS } from '../../stores/model';
import { useAgentStore } from '../../stores/agent';
import { useLayoutStore } from '../../stores/layout';
import { useFilesStore } from '../../stores/files';
import { useModeStore } from '../../stores/mode';
import { useRoleplayStore } from '../../stores/roleplay';
import { useAuthStore } from '../../stores/auth';
import { useAgentRolesStore, resolveSendableRoles } from '../../stores/agentRoles';
import { useConversationStore } from '../../stores/conversationStore';
import { useGroupChatStore } from '../../stores/groupChatStore';
import { getEffectiveStatusFields, getTemplateById } from '../../utils/roleplay';
import {
  buildSessionRoleplayPrompt,
  getRoleplayOpeningMessage,
  getRoleplayStatusRetryMessage,
  getCharactersByIds,
  mapTurnsToMeta,
  resolveSessionCast,
  resolveEffectiveCast,
} from '../../utils/roleplay-multi';
import {
  formatRoleplayMessageForHistory,
  formatMultiRoleplayMessageForHistory,
  shouldRetryRoleplayStatus,
  shouldRetryMultiRoleplayStatus,
} from '../../utils/parseRoleplayResponse';
import MessageBubble from './MessageBubble';
import GroupMessageBubble from './GroupMessageBubble';
import TypingIndicator from './TypingIndicator';
import PlanTodoPanel from './PlanTodoPanel';
import ChatInput, { PastedImage } from './ChatInput';
import ConfirmDialog from './ConfirmDialog';
import ChoiceDialog from './ChoiceDialog';
import { Command } from '../../commands';
import { useStreamHandler } from './useStreamHandler';
import { useGroupStreamHandler } from './useGroupStreamHandler';
import shared from '../../styles/components.module.css';
import { Virtuoso } from 'react-virtuoso';
import styles from './ChatPanel.module.css';

export default function ChatPanel() {
  const { sessions, activeSessionId, isStreaming, addMessage, setStreaming, updateLastAssistant, newAssistantMessage, loadSessions, clearPlanTodos, webPreviewHtml, setWebPreviewHtml, webPreviewFile, setWebPreviewFile } = useChatStore();
  const { loadModels, getActiveModel, loadImageModel, loadVisionModel } = useModelStore();
  const { currentWorkspace, loadWorkspace } = useFilesStore();
  const { setBottomClosed, setBottomExpanded } = useLayoutStore();
  const agentReset = useAgentStore(s => s.reset);
  const virtuosoRef = useRef<any>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmReq, setConfirmReq] = useState<{ confirmId: string; name: string; args?: string } | null>(null);
  const [choiceReq, setChoiceReq] = useState<{ choiceId: string; message: string; choices: Array<{ label: string; description?: string }> } | null>(null);
  const autoApprovedRef = useRef<Set<string>>(new Set());
  const statusRetryUsedRef = useRef(false);
  const projectDir = currentWorkspace || '';

  const session = sessions.find(s => s.id === activeSessionId);
  const messages = session?.messages ?? [];
  const mode = useModeStore(s => s.mode);

  const convActiveId = useConversationStore(s => s.activeId);
  const activeConv = useConversationStore(s => s.conversations.find(c => c.id === s.activeId));
  const groupChat = useGroupChatStore();
  const isGroup = activeConv?.type === 'group_npc' || activeConv?.type === 'group_agent';

  useEffect(() => {
    if (isAtBottomRef.current) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
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
      await useAgentRolesStore.getState().loadRoles();
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
    const chat = useChatStore.getState();
    const currentSession = chat.sessions.find(s => s.id === chat.activeSessionId);
    const cast = resolveSessionCast(currentSession);
    const participants = getCharactersByIds(useRoleplayStore.getState().characters, cast.participantIds);
    const history: any[] = [];
    for (const m of sourceMessages) {
      const meta = m.roleplayMeta as RoleplayMessageMeta | undefined;
      let messageContent: string | typeof m.contentParts = m.content;
      if (m.role === 'user' && m.contentParts?.length) {
        messageContent = m.contentParts;
      } else if (sendMode === 'roleplay' && m.role === 'assistant' && meta?.turns?.length) {
        messageContent = formatMultiRoleplayMessageForHistory(
          meta.turns.map(turn => ({
            character: turn.characterName,
            reply: turn.reply,
            status: turn.status,
            statusComplete: Boolean(turn.statusComplete && turn.status),
          })),
        );
      } else if (sendMode === 'roleplay' && m.role === 'assistant' && meta?.status) {
        messageContent = formatRoleplayMessageForHistory(m.content, meta.status);
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
    // 锁定当前会话 ID，防止切换会话后流式输出串到其他会话
    targetSessionRef.current = useChatStore.getState().activeSessionId;
    agentReset();
    isAtBottomRef.current = true;
  }, [agentReset]);

  const invokeAgent = useCallback(async (opts: {
    history: any[];
    newMessage: string;
    commandPrompt?: string;
    sessionId: string;
  }) => {
    const modelConfig = getActiveModel();
    const sendMode = useModeStore.getState().mode;
    const effectiveApiKey = modelConfig.apiKey || apiKey;
    const roles = sendMode === 'multi-agent'
      ? resolveSendableRoles(
          useAgentRolesStore.getState().roles,
          useModelStore.getState().models,
          modelConfig,
          effectiveApiKey || '',
        )
      : undefined;
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
      roles,
      sessionId: opts.sessionId,
    });
  }, [apiKey, projectDir, getActiveModel]);

  const sendRoleplayStatusRetry = useCallback(async () => {
    const modelConfig = getActiveModel();
    const effectiveApiKey = modelConfig.apiKey || apiKey;
    if (!activeSessionId || !effectiveApiKey || statusRetryUsedRef.current) return;
    if (useModeStore.getState().mode !== 'roleplay') return;

    const chat = useChatStore.getState();
    const target = chat.sessions.find(s => s.id === activeSessionId);
    const last = target?.messages.at(-1);
    if (!last || last.role !== 'assistant') return;

    const cast = resolveSessionCast(target);
    const participants = getCharactersByIds(useRoleplayStore.getState().characters, cast.participantIds);
    if (participants.length === 0) return;
    const raw = last.rawContent || last.content;

    if (cast.isMulti) {
      const npcNames = participants.map(c => c.name);
      if (!shouldRetryMultiRoleplayStatus(raw, npcNames)) return;
    } else {
      const activeCharacter = participants[0];
      const template = getTemplateById(useRoleplayStore.getState().templates, activeCharacter.templateId);
      const expectsStatus = getEffectiveStatusFields(activeCharacter, template).length > 0;
      if (!shouldRetryRoleplayStatus(raw, expectsStatus)) return;
    }

    statusRetryUsedRef.current = true;
    resetStreamBuffers();
    targetSessionRef.current = activeSessionId;
    setStreaming(true);

    const priorMessages = target.messages.slice(0, -1);
    const history = buildHistory(priorMessages);
    const commandPrompt = buildSessionRoleplayPrompt(target, participants, useRoleplayStore.getState().templates);

    try {
      await invokeAgent({
        history,
        newMessage: getRoleplayStatusRetryMessage(target),
        commandPrompt,
        sessionId: activeSessionId,
      });
    } catch (err: unknown) {
      setStreaming(false);
      setErrorMsg(err instanceof Error ? err.message : '状态补全失败');
    }
  }, [activeSessionId, apiKey, getActiveModel, resetStreamBuffers, updateLastAssistant, setStreaming, buildHistory, invokeAgent]);

  const targetSessionRef = useRef<string | null>(null);
  const isMySessionStreaming = isStreaming && targetSessionRef.current === activeSessionId;
  const handleStreamChunk = useStreamHandler({
    targetSessionRef,
    setStreaming: (v) => useChatStore.getState().setStreaming(v),
    setErrorMsg,
    onDone: () => { void sendRoleplayStatusRetry(); },
  });

  // 用 ref 稳定 IPC listener，避免每次渲染都重新注册导致消息丢失
  const handleStreamChunkRef = useRef(handleStreamChunk);
  handleStreamChunkRef.current = handleStreamChunk;
  useEffect(() => {
    const unsubscribe = window.api.agent.onStreamChunk((chunk) => handleStreamChunkRef.current(chunk));
    return () => { unsubscribe(); };
  }, []);

  const handleGroupChunk = useGroupStreamHandler();

  useEffect(() => {
    const unsubscribe = window.api.groupChat.onChunk((convId: string, chunk: any) => {
      const currentId = useConversationStore.getState().activeId;
      if (convId === currentId) {
        handleGroupChunk(convId, chunk);
      }
    });
    return () => { unsubscribe(); };
  }, [handleGroupChunk]);

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
    if (isGroup) {
      if (convActiveId) {
        await window.api.groupChat.cancel(convActiveId);
      }
      groupChat.setGroupActive(false);
      setStreaming(false);
      return;
    }
    targetSessionRef.current = null;
    await window.api.agent.cancel(activeSessionId || undefined);
    setStreaming(false);
  }, [activeSessionId, isGroup, convActiveId]);

  const sendCharacterOpening = useCallback(async (sessionId: string) => {
    const modelConfig = getActiveModel();
    const effectiveApiKey = modelConfig.apiKey || apiKey;
    if (!effectiveApiKey) return;
    const chat = useChatStore.getState();
    const target = chat.sessions.find(s => s.id === sessionId);
    if (!target?.pendingOpening || target.messages.length > 0) return;
    const currentMode = useModeStore.getState().mode;
    if (currentMode !== 'roleplay') {
      chat.clearPendingOpening(sessionId);
      return;
    }

    const cast = resolveEffectiveCast(target, useRoleplayStore.getState().activeCharacterId, currentMode);
    const participants = getCharactersByIds(useRoleplayStore.getState().characters, cast.participantIds);
    if (participants.length === 0) {
      chat.clearPendingOpening(sessionId);
      return;
    }

    chat.clearPendingOpening(sessionId);

    statusRetryUsedRef.current = false;
    resetStreamBuffers();
    targetSessionRef.current = sessionId;
    addMessage({ id: `msg-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() });
    setStreaming(true);

    const templates = useRoleplayStore.getState().templates;
    const authUser = useAuthStore.getState().user;
    const savedName = authUser ? authUser.username : (await window.api.settings.get('roleplayPlayerName'));
    const playerName = savedName || undefined;
    const commandPrompt = buildSessionRoleplayPrompt(target, participants, templates, { forOpening: true, playerName });

    try {
      await invokeAgent({
        history: [],
        newMessage: getRoleplayOpeningMessage(target),
        commandPrompt,
        sessionId,
      });
    } catch (err: unknown) {
      setStreaming(false);
      setErrorMsg(err instanceof Error ? err.message : '开场生成失败');
    }
  }, [apiKey, getActiveModel, resetStreamBuffers, addMessage, setStreaming, invokeAgent]);

  useEffect(() => {
    if (!activeSessionId || isMySessionStreaming || !apiKey) return;
    const target = sessions.find(s => s.id === activeSessionId);
    if (!target?.pendingOpening || target.messages.length > 0) return;
    if (mode !== 'roleplay') return;
    void sendCharacterOpening(activeSessionId);
  }, [activeSessionId, sessions, isMySessionStreaming, apiKey, mode, sendCharacterOpening]);

  const handleSend = useCallback(async (content: string, command?: Command, images?: PastedImage[]) => {
    if (!activeSessionId && !convActiveId) return;
    if (!apiKey) { setShowKeyInput(true); return; }
    setErrorMsg('');
    statusRetryUsedRef.current = false;

    // Group chat path
    if (isGroup) {
      setErrorMsg('');
      const currentActiveId = useConversationStore.getState().activeId;
      if (!currentActiveId) return;
      addMessage({
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        senderName: '我',
        timestamp: Date.now(),
      });
      groupChat.setGroupActive(true);
      setStreaming(true);
      try {
        const convJson = JSON.stringify(activeConv);
        await window.api.groupChat.send(convJson, content);
      } catch (err: unknown) {
        setStreaming(false);
        groupChat.setGroupActive(false);
        setErrorMsg(err instanceof Error ? err.message : '群聊请求失败');
      }
      return;
    }

    if (!activeSessionId) return;

    const displayContent = command ? `/${command.name} ${content}` : content;
    const hasImages = images && images.length > 0;

    const history = buildHistory(messages);
    resetStreamBuffers();
    targetSessionRef.current = activeSessionId;

    const modelConfig = getActiveModel();
    const providerSupportsVision = PROVIDERS[modelConfig.provider]?.multimodal ?? false;
    const imageMarkdown = hasImages ? '\n' + images!.map(im => {
      const displayUrl = im.path ? im.path.replace(/\\/g, '/') : im.dataUrl;
	      return `![image](${displayUrl})`;
    }).join('\n') : '';
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
    const roleplayState = useRoleplayStore.getState();
    const currentSession = useChatStore.getState().sessions.find(s => s.id === activeSessionId);
    const cast = resolveEffectiveCast(currentSession, roleplayState.activeCharacterId, sendMode);
    let participants = getCharactersByIds(roleplayState.characters, cast.participantIds);

    let commandPrompt = command?.systemPrompt;
    if (sendMode === 'roleplay' && participants.length > 0) {
      const authUser = useAuthStore.getState().user;
      const savedName = authUser ? authUser.username : (await window.api.settings.get('roleplayPlayerName'));
      const playerName = savedName || undefined;
      const sessionPrompt = buildSessionRoleplayPrompt(
        currentSession,
        participants,
        useRoleplayStore.getState().templates,
        { playerName },
      );
      commandPrompt = sessionPrompt
        ? (commandPrompt ? `${sessionPrompt}\n\n${commandPrompt}` : sessionPrompt)
        : commandPrompt;
    }
    const userText = content || displayContent || (hasImages ? '请描述这张图片' : '');
    const textContent = userText + (providerSupportsVision ? '' : imageMarkdown);
    const newMessage = contentParts ?? textContent;

    try {
      await invokeAgent({ history, newMessage, commandPrompt, sessionId: activeSessionId });
    } catch (err: unknown) {
      setStreaming(false);
      setErrorMsg(err instanceof Error ? err.message : '请求失败');
    }
  }, [activeSessionId, apiKey, messages, addMessage, setStreaming, buildHistory, resetStreamBuffers, invokeAgent, getActiveModel]);

  const handleExecutePlan = useCallback(async () => {
    if (!activeSessionId) return;
    const s = useChatStore.getState().sessions.find(x => x.id === activeSessionId);
    const todos = s?.planTodos ?? [];
    if (todos.length === 0) return;
    useModeStore.getState().setMode('agent');
    const lines = todos.map((t, i) => `${i + 1}. ${t.content}`).join('\n');
    const docRef = s?.planDocPath ? `\n\n参考计划文档：${s.planDocPath}` : '';
    const msg = `请按照已确认的实施计划，逐项执行下面的任务清单。每开始一项就调用 write_todos 将该项 status 设为 in_progress，完成后设为 completed（每次都传完整列表以同步进度）。全部完成后给出总结。${docRef}\n\n任务清单：\n${lines}`;
    await handleSend(msg);
  }, [activeSessionId, handleSend]);

  return (
    <div className={styles.container}>
      <div
        className={styles.scrollArea}
        data-chat-scroll="true"
      >
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyLogo}><img src="/assets/logo.png" alt="ai" className={styles.emptyLogoImg} /></div>
            {mode === 'roleplay' && session?.pendingOpening ? (
              <>
                <div className={styles.emptyTitle}>{isMySessionStreaming ? '正在生成开场…' : apiKey ? '即将开始角色扮演' : '请先配置 API Key'}</div>
                <div className={styles.emptyHint}>
                  {isMySessionStreaming ? '模型正在根据开场故事撰写第一条消息' : apiKey ? '角色将先发送开场白，之后由你回复' : '保存 API Key 后将自动生成开场'}
                </div>
              </>
            ) : (
              <>
                <div className={styles.emptyTitle}>开始与 Oh My DeepSeek 对话</div>
                <div className={styles.emptyHint}>输入消息或 @ 引用文件</div>
              </>
            )}
          </div>
        )}
                <Virtuoso
          data={messages}
          followOutput="smooth"
          atBottomStateChange={(atBottom) => {
            isAtBottomRef.current = atBottom;
            setShowScrollDown(!atBottom);
          }}
          itemContent={(_index, msg) => (
            isGroup
              ? <GroupMessageBubble key={msg.id} message={msg} />
              : <MessageBubble key={msg.id} message={msg} />
          )}
        />
{isGroup && groupChat.isGroupActive && groupChat.activeSpeaker && (
  <TypingIndicator
    speakerName={groupChat.activeSpeaker}
    speakerAvatar={activeConv?.members.find(m => m.name === groupChat.activeSpeaker)?.avatar}
  />
)}
        {isMySessionStreaming && (
          <div className={styles.thinkingHint}>
            <span className={styles.thinkingIcon}><img src="/assets/8.png" alt="thinking" className={styles.thinkingIconImg} /></span>
            <span>思考中...</span>
          </div>
        )}
        {showScrollDown && (
          <div className={shared.scrollDownBtn} onClick={() => virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' })} title="回到底部">
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
        {session?.planTodos && session.planTodos.length > 0 && (
          <PlanTodoPanel
            todos={session.planTodos}
            planDocPath={session.planDocPath}
            executing={isMySessionStreaming}
            onExecute={() => void handleExecutePlan()}
            onStop={() => void handleStop()}
            onClose={() => clearPlanTodos()}
          />
        )}
        {webPreviewHtml && (
          <div className={styles.webPreviewWrap}>
            <div className={styles.webPreviewBar}>
              <span className={styles.webPreviewLabel}>
                🌐 网页预览
                {isMySessionStreaming && <span className={styles.webPreviewBuilding}> 🔨 构建中...</span>}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {webPreviewFile && (
                  <button
                    onClick={() => window.api.browser.openInline(webPreviewFile)}
                    className={styles.webPreviewClose}
                    title="在内置浏览器中打开"
                    style={{ fontSize: 12 }}
                  >🔗 浏览器打开</button>
                )}
                <button
                  onClick={() => { setWebPreviewHtml(null); setWebPreviewFile(null); }}
                  className={styles.webPreviewClose}
                  title="关闭预览"
                >✕</button>
              </div>
            </div>
            <iframe srcDoc={webPreviewHtml} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation" className={styles.webPreviewFrame} title="web preview" />
          </div>
        )}
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
        <ChatInput onSend={handleSend} disabled={isMySessionStreaming} isStreaming={isMySessionStreaming} onStop={handleStop} />
      </div>
    </div>
  );
}
