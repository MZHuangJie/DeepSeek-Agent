import React, { useEffect, useState } from 'react';
import styles from '../../styles/components.module.css';

interface Choice {
  label: string;
  description?: string;
}

interface Props {
  message: string;
  choices: Choice[];
  onConfirm: (selected: number[], feedback: string) => void;
  onCancel: () => void;
}

export default function ChoiceDialog({ message, choices, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className={styles.dialogBox}>
      {/* Header */}
      <div className={styles.dialogHeader}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>📋 请选择</div>
        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
      </div>

      {/* Choices */}
      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflow: 'auto' }}>
        {choices.map((c, i) => (
          <label
            key={i}
            onClick={() => toggle(i)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
              padding: '6px 8px', borderRadius: 4,
              background: selected.has(i) ? 'rgba(124,58,237,0.12)' : 'transparent',
              border: selected.has(i) ? '1px solid var(--accent)' : '1px solid transparent',
              transition: 'all 0.1s',
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggle(i)}
              style={{ marginTop: 2, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{c.label}</div>
              {c.description && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{c.description}</div>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Feedback input */}
      <div style={{ padding: '8px 14px' }}>
        <input
          type="text"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onConfirm(Array.from(selected).sort(), feedback);
            }
          }}
          placeholder="告诉 AI 你的想法..."
          style={{
            width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-primary)', padding: '6px 10px',
            fontSize: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Actions */}
      <div className={styles.dialogFooter}>
        <button
          onClick={() => onConfirm(Array.from(selected).sort(), feedback)}
          disabled={selected.size === 0}
          className={styles.dialogApprove}
        >
          确认{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
        <button onClick={onCancel} className={styles.dialogCancel}>取消 (Esc)</button>
      </div>
    </div>
  );
}
