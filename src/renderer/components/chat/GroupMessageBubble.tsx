// src/renderer/components/chat/GroupMessageBubble.tsx
import React from 'react';
import type { Message } from '../../../common/conversation';
import { formatRelativeTime } from '../../utils/relativeTime';
import { MessageContent } from './MessageBubble';
import styles from './GroupMessageBubble.module.css';

interface Props {
  message: Message;
}

export default function GroupMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.wrapperUser : ''}`}>
      <div className={styles.avatar} style={{
        background: isUser
          ? 'linear-gradient(135deg, #888, #666)'
          : `linear-gradient(135deg, ${(message.senderName?.charCodeAt(0) || 0) % 2 ? '#667eea' : '#f5576c'}, ${(message.senderName?.charCodeAt(1) || 0) % 2 ? '#764ba2' : '#4facfe'})`
      }}>
        {isUser ? '👤' : (message.senderAvatar
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
          <MessageContent content={message.content} />
        </div>
        <div className={styles.time}>{formatRelativeTime(message.timestamp)}</div>
      </div>
    </div>
  );
}
