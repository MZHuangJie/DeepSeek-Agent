import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import styles from './AccountCenter.module.css';

type Tab = 'login' | 'register';

export default function AccountAuthForm() {
  const { error, login, register, clearError } = useAuthStore();
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim()) return;
    setSubmitting(true);
    clearError();
    if (tab === 'login') {
      await login(username.trim(), password);
    } else {
      await register(username.trim(), password);
    }
    setSubmitting(false);
  };

  return (
    <div className={styles.authWrap}>
      <div className={styles.authCard}>
        <h2 className={styles.authTitle}>登录 DeepSeek Agent 账户</h2>
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => { setTab('login'); clearError(); }}>登录</button>
          <button type="button" className={`${styles.tabBtn} ${tab === 'register' ? styles.tabActive : ''}`} onClick={() => { setTab('register'); clearError(); }}>注册</button>
        </div>
        <label className={styles.fieldLabel}>
          用户名
          <input className={styles.fieldInput} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3–32 位字母、数字或下划线" autoComplete="username" />
        </label>
        <label className={styles.fieldLabel}>
          密码
          <input type="password" className={styles.fieldInput} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()} />
        </label>
        {error && <div className={styles.fieldError}>{error}</div>}
        <button type="button" className={styles.primaryBtn} disabled={submitting || !username.trim()} onClick={() => void handleSubmit()}>
          {submitting ? '提交中…' : tab === 'login' ? '登录' : '注册'}
        </button>
      </div>
    </div>
  );
}
