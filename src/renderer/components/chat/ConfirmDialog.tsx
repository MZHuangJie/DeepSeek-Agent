import React, { useEffect, useRef, useState } from 'react';
import styles from '../../styles/components.module.css';

interface Props {
  name: string;
  args?: string;
  onApprove: (alwaysAllow: boolean) => void;
  onDeny: () => void;
}

export default function ConfirmDialog({ name, args, onApprove, onDeny }: Props) {
  const approveRef = useRef<HTMLButtonElement>(null);
  const [alwaysAllow, setAlwaysAllow] = useState(false);

  useEffect(() => {
    approveRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onApprove(alwaysAllow);
      if (e.key === 'Escape') onDeny();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onApprove, onDeny, alwaysAllow]);

  return (
    <div className={styles.dialogBox}>
      <div className={styles.dialogHeader}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>⚡ 确认执行操作</div>
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
          确认允许 AI 执行 <b style={{ color: 'var(--accent)' }}>{name}</b> 操作？
        </div>
        {args && (
          <pre style={{ margin: '8px 0 0', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflow: 'auto' }}>
            {args}
          </pre>
        )}
      </div>

      <div className={styles.dialogBody}>
        <label className={styles.dialogCheckbox}>
          <input type="checkbox" checked={alwaysAllow} onChange={(e) => setAlwaysAllow(e.target.checked)} />
          本次会话内自动允许 {name} 操作
        </label>
      </div>

      <div className={styles.dialogFooter} style={{ flexDirection: 'column', gap: 6 }}>
        <button ref={approveRef} onClick={() => onApprove(alwaysAllow)} style={{ width: '100%' }} className={styles.dialogApprove}>允许执行 (Enter)</button>
        <button onClick={onDeny} style={{ width: '100%' }} className={styles.dialogCancel}>拒绝 (Esc)</button>
      </div>
    </div>
  );
}
