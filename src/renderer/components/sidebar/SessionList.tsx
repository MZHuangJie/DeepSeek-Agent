import React, { useState } from 'react';
import { useChatStore } from '../../stores/chat';

export default function SessionList() {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession } = useChatStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={{ padding: 8, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Chat Sessions</span>
        <button onClick={createSession} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/assets/13.png" alt="new" style={{ width: 16, height: 16 }} /></button>
      </div>
      {sessions.map(s => (
        <div
          key={s.id}
          onClick={() => switchSession(s.id)}
          onMouseEnter={() => setHoveredId(s.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            padding: '6px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            marginBottom: 2,
            background: s.id === activeSessionId ? 'var(--bg-tertiary)' : 'transparent',
            fontSize: 12,
            color: s.id === activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderLeft: s.id === activeSessionId ? '2px solid var(--accent)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
            transition: 'background 0.15s',
          }}
          title={s.title}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {s.title}
          </span>
          {(hoveredId === s.id || s.id === activeSessionId) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(s.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: 14,
                lineHeight: 1,
                opacity: 0.6,
                flexShrink: 0,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title="删除会话"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {sessions.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, padding: '8px 0' }}>
          点击 + 新建会话
        </div>
      )}
    </div>
  );
}
