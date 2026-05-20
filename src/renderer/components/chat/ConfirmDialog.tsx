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
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 8,
        width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(124,58,237,0.2)',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
            ⚡ 确认执行操作
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>
            {name}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12, fontSize: 13, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          确认允许 AI 执行 <b style={{ color: 'var(--accent)' }}>{name}</b> 操作？
        </div>

        <div style={{ padding: '4px 16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={alwaysAllow} onChange={(e) => setAlwaysAllow(e.target.checked)} />
            本次会话内自动允许 {name} 操作
          </label>
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onDeny} style={{
            padding: '6px 16px', background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          }}>拒绝 (Esc)</button>
          <button ref={approveRef} onClick={() => onApprove(alwaysAllow)} style={{
            padding: '6px 16px', background: 'var(--accent)', border: 'none',
            color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          }}>允许执行 (Enter)</button>
        </div>
      </div>
    </div>
  );
}
