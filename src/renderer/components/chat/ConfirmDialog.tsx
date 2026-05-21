import React, { useEffect, useRef, useState } from 'react';

interface Props {
  name: string;
  onApprove: (alwaysAllow: boolean) => void;
  onDeny: () => void;
}

export default function ConfirmDialog({ name, onApprove, onDeny }: Props) {
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
    <div style={{
      position: 'absolute', left: 8, right: 8, bottom: '100%',
      marginBottom: 6,
      background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 8,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(124,58,237,0.15)',
      zIndex: 50,
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
          ⚡ 确认执行操作
        </div>
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
          确认允许 AI 执行 <b style={{ color: 'var(--accent)' }}>{name}</b> 操作？
        </div>
      </div>

      <div style={{ padding: '8px 14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={alwaysAllow} onChange={(e) => setAlwaysAllow(e.target.checked)} />
          本次会话内自动允许 {name} 操作
        </label>
      </div>

      <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button ref={approveRef} onClick={() => onApprove(alwaysAllow)} style={{
          width: '100%', padding: '8px 12px', background: 'var(--accent)', border: 'none',
          color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500,
        }}>允许执行 (Enter)</button>
        <button onClick={onDeny} style={{
          width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
        }}>拒绝 (Esc)</button>
      </div>
    </div>
  );
}
