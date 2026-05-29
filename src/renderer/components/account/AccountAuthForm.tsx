import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import styles from './AccountCenter.module.css';

type Mode = 'login' | 'register';

export default function AccountAuthForm() {
  const { error, login, register, clearError } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agree, setAgree] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    clearError();
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
  };

  const handleSubmit = async () => {
    if (!username.trim()) return;
    if (mode === 'register') {
      if (password.length < 6) {
        clearError();
        // 通过 store error 显示
        return;
      }
      if (password !== confirmPassword) {
        clearError();
        return;
      }
      if (!agree) {
        clearError();
        return;
      }
    }
    setSubmitting(true);
    clearError();
    if (mode === 'login') {
      await login(username.trim(), password);
    } else {
      await register(username.trim(), password);
    }
    setSubmitting(false);
  };

  const isLogin = mode === 'login';

  return (
    <div className={styles.authWrap}>
      <div className={styles.authCard}>
        <h2 className={styles.authTitle}>
          {isLogin ? '登录' : '注册'} DeepSeek Agent
        </h2>
        <p className={styles.authDesc}>
          {isLogin ? '欢迎回来！请登录您的账户' : '创建新账户以开始使用'}
        </p>

        <div className={styles.authFields}>
          <label className={styles.authFieldLabel}>
            {isLogin ? '用户名或邮箱' : '用户名'}
            <input
              className={styles.authFieldInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isLogin ? '请输入用户名或邮箱' : '3-32 位字母、数字或下划线'}
              autoComplete="username"
            />
          </label>

          {!isLogin && (
            <>
              <label className={styles.authFieldLabel}>
                邮箱地址
                <input
                  className={styles.authFieldInput}
                  type="email"
                  placeholder="请输入有效的邮箱地址"
                  disabled
                  title="邮箱功能即将上线"
                />
              </label>
              <label className={styles.authFieldLabel}>
                邮箱验证码
                <div className={styles.authCodeRow}>
                  <input
                    className={styles.authFieldInput}
                    placeholder="请输入邮箱验证码"
                    disabled
                    title="邮箱功能即将上线"
                  />
                  <button type="button" className={styles.authCodeBtn} disabled>
                    获取验证码
                  </button>
                </div>
              </label>
            </>
          )}

          <label className={styles.authFieldLabel}>
            密码
            <div className={styles.authPasswordWrap}>
              <input
                className={styles.authFieldInput}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? '请输入密码' : '至少 6 位'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
              />
              <button
                type="button"
                className={styles.authEyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M2 2l20 20" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {!isLogin && (
            <label className={styles.authFieldLabel}>
              确认密码
              <div className={styles.authPasswordWrap}>
                <input
                  className={styles.authFieldInput}
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
                />
                <button
                  type="button"
                  className={styles.authEyeBtn}
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M2 2l20 20" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
          )}
        </div>

        {isLogin ? (
          <div className={styles.authOptions}>
            <label className={styles.authCheckLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>记住我</span>
            </label>
            <button type="button" className={styles.authLinkBtn}>
              忘记密码？
            </button>
          </div>
        ) : (
          <label className={styles.authCheckLabel} style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              我已阅读并同意 <button type="button" className={styles.authInlineLink}>服务条款</button> 和 <button type="button" className={styles.authInlineLink}>隐私政策</button>
            </span>
          </label>
        )}

        {error && <div className={styles.authFieldError}>{error}</div>}

        <button
          type="button"
          className={styles.authSubmitBtn}
          disabled={submitting || !username.trim() || (mode === 'register' && (!agree || !confirmPassword))}
          onClick={() => void handleSubmit()}
        >
          {submitting ? '提交中…' : isLogin ? '登录' : '注册'}
        </button>

        <div className={styles.authFooter}>
          {isLogin ? (
            <>
              还没有账户？
              <button type="button" className={styles.authLinkBtn} onClick={() => switchMode('register')}>
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账户？
              <button type="button" className={styles.authLinkBtn} onClick={() => switchMode('login')}>
                立即登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
