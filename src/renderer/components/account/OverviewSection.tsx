import React, { useState } from 'react';
import type { CloudSessionMeta } from '../../stores/sync';
import styles from './AccountCenter.module.css';
import { PortraitBg } from './AccountIcons';

interface OverviewSectionProps {
  user: { id: number; username: string; email: string | null; avatar: string | null };
  sessions: Array<{ id: string; messages: Array<{ timestamp?: number }> }>;
  cloudCharacters: any[];
  cloudTemplates: any[];
  cloudSessions: CloudSessionMeta[];
  cloudLoading: boolean;
  authError: string | null;
  clearError: () => void;
  updateProfile: (updates: { username?: string; email?: string; avatar?: string }) => void;
  logout: () => Promise<void>;
  loadCloudSessions: () => Promise<void>;
  loadCloudCharacters: () => Promise<void>;
  loadCloudTemplates: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  onNavigate: (section: any) => void;
  onImagePreview: (src: string | null) => void;
}

export default function OverviewSection({
  user, sessions, cloudCharacters, cloudTemplates, cloudSessions,
  cloudLoading, authError, clearError, updateProfile, logout,
  loadCloudSessions, loadCloudCharacters, loadCloudTemplates, loadFavorites,
  onNavigate, onImagePreview,
}: OverviewSectionProps) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const initial = user.username[0]?.toUpperCase() || '?';
  const lastMsgTs = sessions.reduce((max, s) => {
    const t = s.messages[s.messages.length - 1]?.timestamp ?? 0;
    return Math.max(max, t);
  }, 0);

  const compressAvatar = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const maxSize = 256;
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
          else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas error')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarPick = async (file: File) => {
    setUpdatingField('avatar');
    try {
      const base64 = await compressAvatar(file);
      await updateProfile({ avatar: base64 });
    } catch { /* ignore */ }
    finally { setUpdatingField(null); }
  };

  const handleFieldBlur = async (field: 'username' | 'email') => {
    const newValue = field === 'username' ? editUsername.trim() : editEmail.trim();
    const currentValue = field === 'username' ? user.username : (user.email || '');
    if (!newValue || newValue === currentValue) return;
    setUpdatingField(field);
    clearError();
    await updateProfile(field === 'username' ? { username: newValue } : { email: newValue });
    setUpdatingField(null);
  };

  const CardGrid = ({ items, type }: { items: any[]; type: 'character' | 'template' }) => {
    if (items.length === 0) return <div className={styles.emptyCard}>暂无云端{type === 'character' ? '角色' : '模板'}，可在角色扮演模式中上传</div>;
    return (
      <div className={styles.cardGridCharacters}>
        {items.slice(0, 3).map(item => (
          <div key={item.id} className={`${styles.featureCard} ${styles.characterCard}`}
            onClick={() => {
              const full = item.portraitFullBase64 || item.portraitBase64;
              if (full) onImagePreview(full);
            }}>
            <PortraitBg src={item.portraitBase64} />
            <div className={styles.featureCardOverlay}>
              <div className={styles.featureCardInfo}>
                <div className={styles.featureTitle}>{item.name}</div>
                <div className={styles.featurePersonality}>{item.personality || item.background || '角色'}</div>
                <div className={styles.featureDesc}>{item.background || '暂无背景故事'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.overviewScroll}>
      <section className={styles.profileHero}>
        <div className={styles.profileMain}>
          <div className={styles.heroAvatar}
            style={user.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}}
            onClick={() => avatarInputRef.current?.click()}
            title="点击更换头像">
            {!user.avatar && initial}
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleAvatarPick(file); e.target.value = ''; }} />
          </div>
          <div className={styles.profileInfo}>
            {isEditingProfile ? (
              <>
                <div className={styles.profileNameRow}>
                  <input type="text" className={styles.profileEditInput} value={editUsername}
                    onChange={(e) => { setEditUsername(e.target.value); clearError(); }}
                    onBlur={() => void handleFieldBlur('username')} placeholder="用户名" maxLength={32} autoFocus
                    disabled={updatingField === 'username'} />
                  {updatingField === 'username' && <span className={styles.profileUpdating}>保存中…</span>}
                </div>
                <input type="text" className={styles.profileEditInput} value={editEmail}
                  onChange={(e) => { setEditEmail(e.target.value); clearError(); }}
                  onBlur={() => void handleFieldBlur('email')} placeholder="邮箱地址"
                  disabled={updatingField === 'email'} style={{ marginTop: 8 }} />
                {updatingField === 'email' && <span className={styles.profileUpdating}>保存中…</span>}
                {authError && <div className={styles.profileEditError}>{authError}</div>}
                <div className={styles.heroActions} style={{ marginTop: 12 }}>
                  <button type="button" className={styles.editProfileBtn} onClick={() => { setIsEditingProfile(false); clearError(); }}>完成编辑</button>
                  <button type="button" className={styles.logoutLink} onClick={() => void logout()}>退出登录</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.profileNameRow}><h1 className={styles.profileName}>{user.username}</h1></div>
                <div className={styles.profileMeta}>{user.email || '未设置邮箱'}</div>
                <div className={styles.profileBio}>Oh My DeepSeek 账户</div>
                <div className={styles.profileJoin}>用户 ID: {user.id}</div>
                <div className={styles.heroActions}>
                  <button type="button" className={styles.editProfileBtn}
                    onClick={() => { setEditUsername(user.username); setEditEmail(user.email || ''); setIsEditingProfile(true); clearError(); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, opacity: 0.6 }}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    编辑资料
                  </button>
                  <button type="button" className={styles.logoutLink} onClick={() => void logout()}>退出登录</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={styles.statsPanel}>
          <div className={styles.statsPanelToolbar}>
            <button type="button" className={styles.refreshBtn} disabled={refreshing || cloudLoading} title="刷新云端数据"
              onClick={async () => {
                setRefreshing(true);
                try { await Promise.all([loadCloudSessions(), loadCloudCharacters(), loadCloudTemplates(), loadFavorites()]); }
                catch (e) { console.error('[OverviewSection] refresh failed:', e); }
                finally { setRefreshing(false); }
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {refreshing || cloudLoading ? '刷新中…' : '刷新'}
            </button>
          </div>
          <div className={styles.statsPanelBody}>
            <StatCol label="云端角色" value={cloudCharacters.length} sub="已同步" />
            <StatCol label="云端模板" value={cloudTemplates.length} sub="已同步" />
            <StatCol label="云端会话" value={cloudSessions.length} sub="已同步" />
            <StatCol label="本地会话" value={sessions.length} sub="当前设备" />
          </div>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHead}>
          <h2>云端角色</h2>
          <button type="button" className={styles.linkBtn} onClick={() => onNavigate('characters')}>查看全部 →</button>
        </div>
        <CardGrid items={cloudCharacters} type="character" />
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHead}>
          <h2>云端模板</h2>
          <button type="button" className={styles.linkBtn} onClick={() => onNavigate('templates')}>查看全部 →</button>
        </div>
        <CardGrid items={cloudTemplates} type="template" />
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHead}>
          <h2>云端会话</h2>
          <button type="button" className={styles.linkBtn} onClick={() => onNavigate('history')}>查看全部 →</button>
        </div>
        <div className={styles.cloudList}>
          {cloudSessions.slice(0, 3).map(cs => (
            <div key={cs.id} className={styles.cloudItem}>
              <div className={styles.cloudItemInfo}>
                <div className={styles.cloudItemTitle}>{cs.title}</div>
                <div className={styles.cloudItemMeta}>{cs.messageCount} 条消息 · {cs.updatedAt && !isNaN(Number(cs.updatedAt)) ? new Date(Number(cs.updatedAt)).toLocaleString('zh-CN') : ''}</div>
              </div>
            </div>
          ))}
          {cloudSessions.length === 0 && <div className={styles.emptyCard}>暂无云端会话</div>}
        </div>
      </section>
    </div>
  );
}

function StatCol({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className={styles.statCol}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statSub}>{sub}</div>
    </div>
  );
}
