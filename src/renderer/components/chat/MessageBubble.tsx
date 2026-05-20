import React from 'react';
import { Message } from '../../stores/chat';
import ThinkingChain from './ThinkingChain';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isUser ? 'var(--accent)' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0, color: '#fff', fontWeight: 600,
      }}>
        <img src={isUser ? '/assets/4.png' : '/assets/logo.png'} alt={isUser ? 'user' : 'ai'} style={{ width: 28, height: 28, borderRadius: '50%' }} />
      </div>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: isUser ? 'var(--chat-user)' : 'var(--chat-ai)',
          border: isUser ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
          fontSize: 13, lineHeight: 1.5,
        }}>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content || '...'}</div>
        </div>
        {message.thinkingContent && (
          <ThinkingChain text={message.thinkingContent} />
        )}
      </div>
    </div>
  );
}
