import React, { useState, useMemo } from 'react';
import styles from '../../styles/components.module.css';

interface Props {
  text: string;
  hasContent?: boolean;
}

const ThinkingChain = React.memo(function ThinkingChain({ text, hasContent }: Props) {
  const [expanded, setExpanded] = useState(false);

  const displayText = useMemo(() => {
    if (!expanded) return text.slice(0, 100);
    return text;
  }, [text, expanded]);

  return (
    <div style={{ marginTop: 6, fontSize: 12 }}>
      <div onClick={() => setExpanded(!expanded)} className={styles.thinkingHeader}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>Thinking {hasContent ? '' : '(思考中...)'}</span>
      </div>
      {expanded && <div className={styles.thinkingBody}>{displayText}</div>}
    </div>
  );
});

export default ThinkingChain;
