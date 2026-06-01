// src/renderer/components/chat/TypingIndicator.tsx
import React from 'react';

interface Props {
  speakerName: string;
  speakerAvatar?: string;
}

export default function TypingIndicator({ speakerName, speakerAvatar }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '8px 12px', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: speakerAvatar
          ? `url(${speakerAvatar}) center/cover`
          : 'linear-gradient(135deg, #667eea, #764ba2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: '#fff', flexShrink: 0,
      }}>
        {!speakerAvatar && speakerName[0]}
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {speakerName}
        </div>
        <div style={{
          background: 'var(--bg-tertiary)', borderRadius: '6px 6px 6px 2px',
          padding: '8px 16px', display: 'flex', gap: 4, alignItems: 'center',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)',
            animation: 'typingBounce 1.4s infinite',
          }} />
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)',
            animation: 'typingBounce 1.4s infinite 0.2s',
          }} />
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)',
            animation: 'typingBounce 1.4s infinite 0.4s',
          }} />
        </div>
      </div>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
