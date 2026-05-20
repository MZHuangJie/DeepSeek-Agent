import React, { useState } from 'react';

interface Props {
  text: string;
}

export default function ThinkingChain({ text }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginTop: 6, fontSize: 12 }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 0', userSelect: 'none',
      }}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Thinking</span>
      </div>
      {expanded && (
        <div style={{
          marginTop: 4, padding: '8px 12px', background: 'var(--bg-tertiary)',
          borderRadius: 6, border: '1px solid var(--border)',
          color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}
