import React, { useEffect, useState, useMemo } from 'react';

interface Props {
  text: string;
  hasContent?: boolean;
}

const ThinkingChain = React.memo(function ThinkingChain({ text, hasContent }: Props) {
  const [expanded, setExpanded] = useState(!hasContent);

  useEffect(() => {
    if (hasContent) setExpanded(false);
  }, [hasContent]);

  const displayText = useMemo(() => {
    if (!expanded) return text.slice(0, 100);
    return text;
  }, [text, expanded]);

  return (
    <div style={{ marginTop: 6, fontSize: 12 }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 0', userSelect: 'none',
      }}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Thinking {hasContent ? '' : '(思考中...)'}</span>
      </div>
      {expanded && (
        <div style={{
          marginTop: 4, padding: '8px 12px', background: 'var(--bg-tertiary)',
          borderRadius: 6, border: '1px solid var(--border)',
          color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {displayText}
        </div>
      )}
    </div>
  );
});

export default ThinkingChain;
