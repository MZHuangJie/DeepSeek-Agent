// src/renderer/components/chat/useGroupStreamHandler.ts
import { useCallback } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { useGroupChatStore } from '../../stores/groupChatStore';
import { useAgentStore } from '../../stores/agent';
import {
  parseRoleplayResponse,
  stripRoleplayReplyTags,
} from '../../utils/parseRoleplayResponse';
import type { GroupChunk } from '../../../common/conversation';

export function useGroupStreamHandler() {
  const { setActiveSpeaker, setTyping, setGroupActive } = useGroupChatStore();

  const handleChunk = useCallback((_convId: string, chunk: GroupChunk) => {
    const store = useConversationStore.getState();
    switch (chunk.type) {
      case 'typing':
        if (chunk.speaker) {
          setActiveSpeaker(chunk.speaker.name);
          setTyping(chunk.speaker.roleId, true);

          // 防御：如果最后一条已经是同一个 speaker 的空占位消息，不重复创建
          const convs = store.conversations;
          const activeId = store.activeId;
          const conv = convs.find(c => c.id === activeId);
          const lastMsg = conv?.messages[conv.messages.length - 1];
          if (
            lastMsg &&
            lastMsg.role === 'assistant' &&
            lastMsg.senderId === chunk.speaker.roleId &&
            lastMsg.content === ''
          ) {
            break;
          }

          // Create placeholder message for this speaker
          store.addMessage({
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: '',
            senderId: chunk.speaker.roleId,
            senderName: chunk.speaker.name,
            senderAvatar: chunk.speaker.avatar,
            timestamp: Date.now(),
          });
        }
        break;

      case 'text':
        if (chunk.speaker) {
          setTyping(chunk.speaker.roleId, false);
          setActiveSpeaker(chunk.speaker.name);
        }
        // Accumulate text into the last message for this speaker
        if (chunk.text) {
          const convs = store.conversations;
          const activeId = store.activeId;
          const conv = convs.find(c => c.id === activeId);
          const lastMsg = conv?.messages[conv.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.senderId === chunk.speaker?.roleId) {
            store.updateLastAssistant({ content: lastMsg.content + chunk.text });
          }
        }
        break;

      case 'message-done':
        setActiveSpeaker(null);
        if (chunk.speaker) {
          setTyping(chunk.speaker.roleId, false);
        }
        // Parse roleplay XML from the completed reply: extract display content and status meta
        if (chunk.reply && /<reply\s*>|<\/reply\s*>|<status\s*>/i.test(chunk.reply)) {
          const convs = store.conversations;
          const activeId = store.activeId;
          const conv = convs.find(c => c.id === activeId);
          const lastMsg = conv?.messages[conv.messages.length - 1];
          if (
            lastMsg &&
            lastMsg.role === 'assistant' &&
            lastMsg.senderId === chunk.speaker?.roleId
          ) {
            const parsed = parseRoleplayResponse(chunk.reply);
            const upd: Record<string, unknown> = {
              rawContent: chunk.reply,
              content: parsed.reply || stripRoleplayReplyTags(chunk.reply),
            };
            if (parsed.status) {
              upd.roleplayMeta = { status: parsed.status, statusComplete: parsed.statusComplete };
            }
            store.updateLastAssistant(upd);
          }
        }
        break;

      case 'group-done':
        store.setStreaming(false);
        setGroupActive(false);
        setActiveSpeaker(null);
        break;

      case 'error':
        store.setStreaming(false);
        setGroupActive(false);
        setActiveSpeaker(null);
        break;

      case 'usage':
        if (chunk.usage) {
          const u = chunk.usage;
          useAgentStore.getState().setMainTokenStats({
            total: u.total, prompt: u.prompt, completion: u.completion,
            toolTokens: 0, contextWindow: u.prompt, contextMax: 100000,
            cost: parseFloat(((u.prompt * 0.00000196) + (u.completion * 0.00000798)).toFixed(4)),
            promptCacheHit: u.promptCacheHit, promptCacheMiss: u.promptCacheMiss,
            modelName: u.modelName,
          });
        }
        break;

      case 'director-thinking':
        // Could show a subtle indicator, but for now just ignore
        break;
    }
  }, [setActiveSpeaker, setTyping, setGroupActive]);

  return handleChunk;
}
