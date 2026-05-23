import React, { useEffect, useState } from 'react';
import shared from '../../styles/components.module.css';
import styles from './ChoiceDialog.module.css';

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
    <div className={shared.dialogBox}>
      <div className={shared.dialogHeader}>
        <div className={styles.choiceTitle}>📋 请选择</div>
        <div className={styles.choiceMessage}>{message}</div>
      </div>

      <div className={styles.choiceList}>
        {choices.map((c, i) => (
          <label
            key={i}
            onClick={() => toggle(i)}
            className={`${styles.choiceItem} ${selected.has(i) ? styles.choiceItemSelected : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggle(i)}
              className={styles.choiceCheckbox}
            />
            <div>
              <div className={styles.choiceLabel}>{c.label}</div>
              {c.description && (
                <div className={styles.choiceDesc}>{c.description}</div>
              )}
            </div>
          </label>
        ))}
      </div>

      <div className={styles.feedbackWrap}>
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
          className={styles.feedbackInput}
        />
      </div>

      <div className={shared.dialogFooter}>
        <button
          onClick={() => onConfirm(Array.from(selected).sort(), feedback)}
          disabled={selected.size === 0}
          className={shared.dialogApprove}
        >
          确认{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
        <button onClick={onCancel} className={shared.dialogCancel}>取消 (Esc)</button>
      </div>
    </div>
  );
}
