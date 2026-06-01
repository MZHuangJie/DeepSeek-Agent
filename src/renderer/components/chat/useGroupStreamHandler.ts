// src/renderer/components/chat/useGroupStreamHandler.ts
import { useCallback } from 'react';
import { useConversationStore } from '../../stores/conversationStore';
import { useGroupChatStore } from '../../stores/groupChatStore';
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

      case 'director-thinking':
        // Could show a subtle indicator, but for now just ignore
        break;
    }
  }, [setActiveSpeaker, setTyping, setGroupActive]);

  return handleChunk;
}
