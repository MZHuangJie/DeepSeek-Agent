// src/renderer/components/chat/GroupMessageBubble.tsx
import React, { useMemo } from 'react';
import type { Message } from '../../../common/conversation';
import { formatRelativeTime } from '../../utils/relativeTime';
import { MessageContent } from './MessageBubble';
import { useAuthStore } from '../../stores/auth';
import { useConversationStore } from '../../stores/conversationStore';
import { useRoleplayStore } from '../../stores/roleplay';
import RoleplayStatusPanel from '../roleplay/RoleplayStatusPanel';
import type { RoleplayMessageMeta } from '../../stores/chat';
import {
  parseRoleplayResponse,
  stripRoleplayReplyTags,
} from '../../utils/parseRoleplayResponse';
import { getEffectiveStatusFields } from '../../utils/roleplay';
import styles from './GroupMessageBubble.module.css';

interface Props {
  message: Message;
}

export default function GroupMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const authAvatar = useAuthStore(s => s.user?.avatar);

  const userAvatar = authAvatar
    ? <img src={authAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    : '👤';

  // Parse roleplay XML content for NPC messages in group chat
  const { displayContent, roleplayStatus, statusFieldDefs } = useMemo(() => {
    if (isUser) return { displayContent: message.content, roleplayStatus: null, statusFieldDefs: [] };

    // Check pre-parsed meta first
    const meta = message.roleplayMeta as RoleplayMessageMeta | undefined;
    if (meta?.status) {
      const fieldDefs = (meta as any).fieldDefs || [];
      return { displayContent: message.content, roleplayStatus: meta.status, statusFieldDefs: fieldDefs };
    }

    // Fall back to parsing raw content or rawContent
    const raw = message.rawContent || message.content;
    if (/<reply\s*>|<\/reply\s*>|<status\s*>/i.test(raw)) {
      const parsed = parseRoleplayResponse(raw);
      let fieldDefs: ReturnType<typeof getEffectiveStatusFields> = [];
      if (parsed.status) {
        // Resolve fieldDefs from the speaker's character
        try {
          const conv = useConversationStore.getState().conversations.find(
            c => c.id === useConversationStore.getState().activeId,
          );
          const speaker = conv?.members.find(m => m.roleId === message.senderId);
          const characters = useRoleplayStore.getState().characters;
          const character = characters.find(
            c => c.id === message.senderId || c.name === speaker?.name,
          );
          if (character) {
            const templates = useRoleplayStore.getState().templates;
            const template = templates.find(t => t.id === character.templateId);
            fieldDefs = getEffectiveStatusFields(character, template ?? null);
          }
        } catch { /* best-effort */ }
      }
      return {
        displayContent: parsed.reply || stripRoleplayReplyTags(raw),
        roleplayStatus: parsed.status || null,
        statusFieldDefs: fieldDefs,
      };
    }

    return { displayContent: message.content, roleplayStatus: null, statusFieldDefs: [] };
  }, [isUser, message.content, message.rawContent, message.roleplayMeta, message.senderId]);

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.wrapperUser : ''}`}>
      <div className={styles.avatar} style={{
        background: isUser
          ? 'linear-gradient(135deg, #888, #666)'
          : `linear-gradient(135deg, ${(message.senderName?.charCodeAt(0) || 0) % 2 ? '#667eea' : '#f5576c'}, ${(message.senderName?.charCodeAt(1) || 0) % 2 ? '#764ba2' : '#4facfe'})`
      }}>
        {isUser ? userAvatar : (message.senderAvatar
          ? <img src={message.senderAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : message.senderName?.[0] || '?' )}
      </div>
      <div className={styles.body}>
        {message.senderName && (
          <div className={`${styles.name} ${isUser ? styles.nameUser : ''}`}>
            {message.senderName}
          </div>
        )}
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleOther}`}>
          <MessageContent content={displayContent || '...'} />
        </div>
        {!isUser && roleplayStatus && statusFieldDefs.length > 0 && (
          <RoleplayStatusPanel
            status={roleplayStatus}
            fieldDefs={statusFieldDefs}
          />
        )}
        <div className={styles.time}>{formatRelativeTime(message.timestamp)}</div>
      </div>
    </div>
  );
}
