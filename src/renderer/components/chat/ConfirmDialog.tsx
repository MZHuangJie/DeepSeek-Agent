import React, { useEffect, useRef, useState } from 'react';
import shared from '../../styles/components.module.css';
import styles from './ConfirmDialog.module.css';

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
    <div className={shared.dialogBox}>
      <div className={shared.dialogHeader}>
        <div className={styles.confirmTitle}>⚡ 确认执行操作</div>
        <div className={styles.confirmMessage}>
          确认允许 AI 执行 <b className={styles.confirmName}>{name}</b> 操作？
        </div>
        {args && (
          <pre className={styles.diffPreview}>{args}</pre>
        )}
      </div>

      <div className={shared.dialogBody}>
        <label className={shared.dialogCheckbox}>
          <input type="checkbox" checked={alwaysAllow} onChange={(e) => setAlwaysAllow(e.target.checked)} />
          本次会话内自动允许 {name} 操作
        </label>
      </div>

      <div className={shared.dialogFooter} style={{ flexDirection: 'column', gap: 6 }}>
        <button ref={approveRef} onClick={() => onApprove(alwaysAllow)} className={`${shared.dialogApprove} ${styles.footerWide}`}>允许执行 (Enter)</button>
        <button onClick={onDeny} className={`${shared.dialogCancel} ${styles.footerWide}`}>拒绝 (Esc)</button>
      </div>
    </div>
  );
}
