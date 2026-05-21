import React from 'react';

interface Props {
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function FallbackEditor({ content, language, onChange, readOnly = false }: Props) {
  return (
    <textarea
      value={content}
      onChange={e => onChange?.(e.target.value)}
      readOnly={readOnly}
      spellCheck={false}
      style={{
        width: '100%', height: '100%',
        background: 'var(--bg-primary)', color: 'var(--text-primary)',
        border: 'none', outline: 'none',
        fontFamily: "'Fira Code', 'Consolas', monospace",
        fontSize: 13, lineHeight: 1.6,
        padding: '8px 12px',
        resize: 'none',
        whiteSpace: 'pre',
        overflow: 'auto',
      }}
    />
  );
}
