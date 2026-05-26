import React, { useEffect, useRef, useState } from 'react';
import shared from '../../styles/components.module.css';
import styles from './GitPassphraseDialog.module.css';

interface Props {
  prompt: string;
  keyPath: string;
  onSubmit: (password: string, remember: boolean) => void;
  onCancel: () => void;
}

function displayKeyPath(keyPath: string): string {
  return keyPath.replace(/^\/c\//i, 'C:/').replace(/^\/c\/Users\//i, 'C:/Users/');
}

export default function GitPassphraseDialog({ prompt, keyPath, onSubmit, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && password.trim()) onSubmit(password, remember);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, onSubmit, password, remember]);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>SSH 密钥密码</div>
        <div className={styles.message}>
          Git 需要解锁 SSH 私钥以连接远程仓库。
        </div>
        <div className={styles.keyPath}>{displayKeyPath(keyPath)}</div>
        {prompt && prompt !== keyPath && (
          <div className={styles.promptHint}>{prompt}</div>
        )}
        <input
          ref={inputRef}
          type="password"
          className={styles.input}
          placeholder="输入密钥 passphrase"
          value={password}
          autoComplete="off"
          onChange={e => setPassword(e.target.value)}
        />
        <label className={shared.dialogCheckbox}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          本会话内记住（不再重复询问）
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            className={shared.dialogApprove}
            disabled={!password.trim()}
            onClick={() => onSubmit(password, remember)}
          >
            确认
          </button>
          <button type="button" className={shared.dialogCancel} onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
