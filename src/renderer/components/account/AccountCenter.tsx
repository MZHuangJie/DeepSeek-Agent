import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useSyncStore } from '../../stores/sync';
import { useChatStore } from '../../stores/chat';
import { useRoleplayStore } from '../../stores/roleplay';
import { useSquareStore } from '../../stores/square';
import AccountAuthForm from './AccountAuthForm';
import SquarePanel from './SquarePanel';
import { useToastStore } from '../../stores/toast';
import styles from './AccountCenter.module.css';

function PortraitBg({ src, path }: { src?: string; path?: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(src || null);
  useEffect(() => {
    if (src) { setImgSrc(src); return; }
    if (!path) { setImgSrc(null); return; }
    let cancelled = false;
    void window.api.files.readBinary(path).then(url => {
      if (!cancelled) setImgSrc(url);
    }).catch(() => { if (!cancelled) setImgSrc(null); });
    return () => { cancelled = true; };
  }, [src, path]);
  if (imgSrc) {
    return <div className={styles.portraitBg} style={{ backgroundImage: `url(${imgSrc})` }} />;
  }
  return (
    <div className={styles.portraitBgEmpty}>
      <span className={styles.portraitPlaceholder}>?</span>
    </div>
  );
}

export type AccountSection =
  | 'overview'
  | 'characters'
  | 'templates'
  | 'history'
  | 'favorites'
  | 'square';

/* ── Sidebar SVG icons (stroke style) ── */
function IconOverview({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconCharacter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
function IconTemplate({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </svg>
  );
}
function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function IconShare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconSquare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

interface NavItem {
  id: AccountSection;
  label: string;
  icon: React.FC<{ className?: string }>;
  group?: 'main' | 'footer';
}

const NAV: NavItem[] = [
  { id: 'overview', label: '账户概览', icon: IconOverview, group: 'main' },
  { id: 'characters', label: '角色卡片', icon: IconCharacter, group: 'main' },
  { id: 'templates', label: '我的模板', icon: IconTemplate, group: 'main' },
  { id: 'history', label: '对话历史', icon: IconChat, group: 'main' },
  { id: 'favorites', label: '收藏夹', icon: IconStar, group: 'main' },
  { id: 'square', label: '角色广场', icon: IconSquare, group: 'main' },
];

interface Props {
  onClose: () => void;
}

export default function AccountCenter({ onClose }: Props) {
  const { user, status, logout, updateProfile, error: authError, clearError } = useAuthStore();
  const sessions = useChatStore(s => s.sessions);
  const {
    characters, templates, loadAll, saveCharacter, saveTemplate,
  } = useRoleplayStore();
  const {
    cloudSessions, cloudCharacters, cloudTemplates, loading: cloudLoading, error: cloudError,
    loadCloudSessions, loadCloudCharacters, loadCloudTemplates, pullCharacter, pullSession, pullTemplate, pushTemplate,
    deleteCloudCharacter, deleteCloudSession, deleteCloudTemplate,
  } = useSyncStore();
  const { favorites, loadFavorites, toggleFavorite, toggleCharacterShared, toggleTemplateShared, loadCharacters, loadTemplates } = useSquareStore();
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<AccountSection>('overview');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const isLoggedIn = status === 'authenticated' && user;

  useEffect(() => {
    void loadAll();
    if (!isLoggedIn) return;
    (async () => {
      try {
        await loadCloudSessions();
      } catch (e) {
        console.error('[AccountCenter] loadCloudSessions failed:', e);
      }
      try {
        await loadCloudCharacters();
      } catch (e) {
        console.error('[AccountCenter] loadCloudCharacters failed:', e);
      }
      try {
        await loadCloudTemplates();
      } catch (e) {
        console.error('[AccountCenter] loadCloudTemplates failed:', e);
      }
      try {
        await loadFavorites();
      } catch (e) {
        console.error('[AccountCenter] loadFavorites failed:', e);
      }
    })();
  }, [loadAll, loadCloudSessions, loadCloudCharacters, loadCloudTemplates, loadFavorites, isLoggedIn]);

  const mainNav = NAV.filter(n => n.group === 'main');

  const renderPlaceholder = (title: string, hint: string) => (
    <div className={styles.placeholder}>
      <div className={styles.placeholderTitle}>{title}</div>
      <div className={styles.placeholderHint}>{hint}</div>
    </div>
  );

  const compressAvatar = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const maxSize = 256;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
          } else {
            if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
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
    if (!user) return;
    try {
      setUpdatingField('avatar');
      const base64 = await compressAvatar(file);
      await updateProfile({ avatar: base64 });
    } catch {
      // ignore
    } finally {
      setUpdatingField(null);
    }
  };

  const handleFieldBlur = async (field: 'username' | 'email') => {
    if (!user) return;
    const newValue = field === 'username' ? editUsername.trim() : editEmail.trim();
    const currentValue = field === 'username' ? user.username : (user.email || '');
    if (!newValue || newValue === currentValue) return;
    setUpdatingField(field);
    clearError();
    await updateProfile(field === 'username' ? { username: newValue } : { email: newValue });
    setUpdatingField(null);
  };

  const renderOverview = () => {
    if (!user) return null;
    const initial = user.username[0]?.toUpperCase() || '?';
    const lastMsgTs = sessions.reduce((max, s) => {
      const t = s.messages[s.messages.length - 1]?.timestamp ?? 0;
      return Math.max(max, t);
    }, 0);

    return (
      <>
        <div className={styles.overviewScroll}>
          <section className={styles.profileHero}>
            <div className={styles.profileMain}>
              <div
                className={styles.heroAvatar}
                style={user.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : {}}
                onClick={() => avatarInputRef.current?.click()}
                title="点击更换头像"
              >
                {!user.avatar && initial}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAvatarPick(file);
                    e.target.value = '';
                  }}
                />
              </div>
              <div className={styles.profileInfo}>
                {isEditingProfile ? (
                  <>
                    <div className={styles.profileNameRow}>
                      <input
                        type="text"
                        className={styles.profileEditInput}
                        value={editUsername}
                        onChange={(e) => { setEditUsername(e.target.value); clearError(); }}
                        onBlur={() => void handleFieldBlur('username')}
                        placeholder="用户名"
                        maxLength={32}
                        autoFocus
                        disabled={updatingField === 'username'}
                      />
                      {updatingField === 'username' && <span className={styles.profileUpdating}>保存中…</span>}
                    </div>
                    <input
                      type="text"
                      className={styles.profileEditInput}
                      value={editEmail}
                      onChange={(e) => { setEditEmail(e.target.value); clearError(); }}
                      onBlur={() => void handleFieldBlur('email')}
                      placeholder="邮箱地址"
                      disabled={updatingField === 'email'}
                      style={{ marginTop: 8 }}
                    />
                    {updatingField === 'email' && <span className={styles.profileUpdating}>保存中…</span>}
                    {authError && <div className={styles.profileEditError}>{authError}</div>}
                    <div className={styles.heroActions} style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className={styles.editProfileBtn}
                        onClick={() => { setIsEditingProfile(false); clearError(); }}
                      >
                        完成编辑
                      </button>
                      <button type="button" className={styles.logoutLink} onClick={() => void logout()}>退出登录</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.profileNameRow}>
                      <h1 className={styles.profileName}>{user.username}</h1>
                    </div>
                    <div className={styles.profileMeta}>{user.email || '未设置邮箱'}</div>
                    <div className={styles.profileBio}>DeepSeek Agent 账户</div>
                    <div className={styles.profileJoin}>
                      <span className={styles.joinIcon} aria-hidden>📅</span>
                      用户 ID: {user.id}
                    </div>
                    <div className={styles.heroActions}>
                      <button
                        type="button"
                        className={styles.editProfileBtn}
                        onClick={() => { setEditUsername(user.username); setEditEmail(user.email || ''); setIsEditingProfile(true); clearError(); }}
                      >
                        <span className={styles.editIcon} aria-hidden>✎</span>
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
                <button
                  type="button"
                  className={styles.refreshBtn}
                  disabled={refreshing || cloudLoading}
                  title="刷新云端数据"
                  onClick={async () => {
                    setRefreshing(true);
                    try {
                      await Promise.all([loadCloudSessions(), loadCloudCharacters(), loadCloudTemplates(), loadFavorites()]);
                    } catch (e) {
                      console.error('[AccountCenter] refresh failed:', e);
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {refreshing || cloudLoading ? '刷新中…' : '刷新'}
                </button>
              </div>
              <div className={styles.statsPanelBody}>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>云端角色</div>
                <div className={styles.statValue}>{cloudCharacters.length}</div>
                <div className={styles.statSub}>已同步</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>云端模板</div>
                <div className={styles.statValue}>{cloudTemplates.length}</div>
                <div className={styles.statSub}>已同步</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>云端会话</div>
                <div className={styles.statValue}>{cloudSessions.length}</div>
                <div className={styles.statSub}>已同步</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>本地会话</div>
                <div className={styles.statValue}>{sessions.length}</div>
                <div className={styles.statSub}>当前设备</div>
              </div>
              </div>
            </div>
          </section>

        <section className={styles.sectionBlock}>
          <div className={styles.sectionHead}>
            <h2>云端角色</h2>
            <button type="button" className={styles.linkBtn} onClick={() => setSection('characters')}>查看全部 →</button>
          </div>
          <div className={styles.cardGridCharacters}>
            {cloudCharacters.slice(0, 3).map(cc => (
              <div
                key={cc.id}
                className={`${styles.featureCard} ${styles.characterCard}`}
                onClick={() => {
                  const full = cc.portraitFullBase64 || cc.portraitBase64;
                  if (full) { setFullImageSrc(full); setShowFullImage(true); }
                }}
              >
                <PortraitBg src={cc.portraitBase64} />
                <div className={styles.featureCardOverlay}>
                  <div className={styles.featureCardInfo}>
                    <div className={styles.featureTitle}>{cc.name}</div>
                    <div className={styles.featurePersonality}>{cc.personality || cc.background || '角色'}</div>
                    <div className={styles.featureDesc}>{cc.background || '暂无背景故事'}</div>
                  </div>
                </div>
              </div>
            ))}
            {cloudCharacters.length === 0 && <div className={styles.emptyCard}>暂无云端角色，可在角色扮演模式中上传</div>}
          </div>
        </section>

        <section className={styles.sectionBlock}>
          <div className={styles.sectionHead}>
            <h2>云端模板</h2>
            <button type="button" className={styles.linkBtn} onClick={() => setSection('templates')}>查看全部 →</button>
          </div>
          <div className={styles.cardGridCharacters}>
            {cloudTemplates.slice(0, 3).map(ct => (
              <div
                key={ct.id}
                className={`${styles.featureCard} ${styles.characterCard}`}
                onClick={() => {
                  const full = ct.portraitFullBase64 || ct.portraitBase64;
                  if (full) { setFullImageSrc(full); setShowFullImage(true); }
                }}
              >
                <PortraitBg src={ct.portraitBase64} />
                <div className={styles.featureCardOverlay}>
                  <div className={styles.featureCardInfo}>
                    <div className={styles.featureTitle}>{ct.name}</div>
                    <div className={styles.featurePersonality}>{ct.personality || ct.background || '角色模板'}</div>
                    <div className={styles.featureDesc}>{ct.background || '暂无背景故事'}</div>
                  </div>
                </div>
              </div>
            ))}
            {cloudTemplates.length === 0 && (
              <div className={styles.emptyCard}>暂无云端模板，可在角色扮演模式中上传</div>
            )}
          </div>
        </section>

        <section className={styles.sectionBlock}>
          <div className={styles.sectionHead}>
            <h2>云端会话</h2>
            <button type="button" className={styles.linkBtn} onClick={() => setSection('history')}>查看全部 →</button>
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
      </>
    );
  };

  const renderContent = () => {
    if (!isLoggedIn) return <AccountAuthForm />;
    switch (section) {
      case 'overview': return renderOverview();
      case 'characters':
        return (
          <div className={styles.pageScroll}>
            <div className={styles.pageHeader}>
              <h2>☁ 云端角色</h2>
              <span className={styles.pageSub}>共 {cloudCharacters.length} 个，可恢复到本地</span>
            </div>
            {cloudError && (
              <div style={{ padding: '0 16px', fontSize: 12, color: '#fca5a5' }}>⚠ {cloudError}</div>
            )}
            <div className={styles.cardGridCharacters}>
              {cloudCharacters.map(cc => {
                const alreadyLocal = characters.some(c => c.id === cc.id);
                return (
                  <div
                    key={cc.id}
                    className={`${styles.featureCard} ${styles.characterCard}`}
                    onClick={() => {
                      const full = cc.portraitFullBase64 || cc.portraitBase64;
                      if (full) { setFullImageSrc(full); setShowFullImage(true); }
                    }}
                  >
                    <PortraitBg src={cc.portraitBase64} />
                    <div className={styles.featureCardOverlay}>
                      <div className={styles.featureCardInfo}>
                        <div className={styles.featureTitle}>{cc.name}</div>
                        <div className={styles.featurePersonality}>{cc.personality || cc.background || '角色'}</div>
                        <div className={styles.featureDesc}>{cc.background || '暂无背景故事'}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.cardStatusTag}
                      style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
                      disabled={alreadyLocal}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const data = await pullCharacter(cc.id);
                        if (!data) { useToastStore.getState().show('拉取失败', 'error'); return; }
                        try {
                          const parsed = JSON.parse(data.payload);
                          const characterId = parsed.id || cc.id;
                          let portraitPath = parsed.portraitPath;
                          let portraitFullPath = parsed.portraitFullPath;
                          if (parsed.portraitBase64) {
                            try {
                              portraitPath = await window.api.files.saveBase64Image(
                                parsed.portraitBase64,
                                `portraits/${characterId}`
                              );
                            } catch (e) { console.warn('保存头像失败', e); }
                          }
                          if (parsed.portraitFullBase64) {
                            try {
                              portraitFullPath = await window.api.files.saveBase64Image(
                                parsed.portraitFullBase64,
                                `portraits/${characterId}-full`
                              );
                            } catch (e) { console.warn('保存全身像失败', e); }
                          }
                          await saveCharacter({
                            id: characterId,
                            templateId: parsed.templateId,
                            name: parsed.name || cc.name,
                            gender: parsed.gender,
                            occupation: parsed.occupation,
                            personality: parsed.personality,
                            background: parsed.background,
                            body: parsed.body,
                            openingStory: parsed.openingStory,
                            portraitPath,
                            portraitFullPath,
                            statusFieldEnabled: parsed.statusFieldEnabled,
                            statusFields: parsed.statusFields,
                          });
                          await loadAll();
                          useToastStore.getState().show(`「${cc.name}」已恢复到本地，可在角色扮演模式中使用`, 'success');
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : '解析角色数据失败';
                          useToastStore.getState().show(`恢复角色失败: ${msg}`, 'error');
                          console.error(e);
                        }
                      }}
                    >
                      {alreadyLocal ? '已同步' : '☁ 恢复'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.shareBtn} ${cc.shared ? styles.shareBtnActive : ''}`}
                      title={cc.shared ? '已分享到广场，点击取消' : '分享到广场'}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const shared = await toggleCharacterShared(cc.id);
                        if (shared === null) {
                          useToastStore.getState().show('操作失败', 'error');
                        } else {
                          useToastStore.getState().show(shared ? '已分享到广场' : '已取消分享', 'success');
                          void loadCloudCharacters();
                          void loadCharacters();
                        }
                      }}
                    >
                      <IconShare />
                    </button>
                    <button
                      type="button"
                      className={styles.cloudDeleteBtn}
                      title="删除云端角色"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`确定删除云端角色「${cc.name}」？`)) return;
                        const ok = await deleteCloudCharacter(cc.id);
                        if (ok) {
                          useToastStore.getState().show(`已删除「${cc.name}」`, 'success');
                          void loadCloudCharacters();
                        } else {
                          useToastStore.getState().show('删除失败', 'error');
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {cloudCharacters.length === 0 && (
                <div className={styles.emptyCard}>暂无云端角色，可在角色扮演模式中上传</div>
              )}
            </div>
          </div>
        );
      case 'templates':
        return (
          <div className={styles.pageScroll}>
            <div className={styles.pageHeader}>
              <h2>☁ 云端模板</h2>
              <span className={styles.pageSub}>共 {cloudTemplates.length} 个，可恢复到本地</span>
            </div>
            {cloudError && (
              <div style={{ padding: '0 16px', fontSize: 12, color: '#fca5a5' }}>⚠ {cloudError}</div>
            )}
            <div className={styles.cardGridCharacters}>
              {cloudTemplates.map(ct => {
                const alreadyLocal = templates.some(t => t.id === ct.id);
                return (
                  <div
                    key={ct.id}
                    className={`${styles.featureCard} ${styles.characterCard}`}
                    onClick={() => {
                      const full = ct.portraitFullBase64 || ct.portraitBase64;
                      if (full) { setFullImageSrc(full); setShowFullImage(true); }
                    }}
                  >
                    <PortraitBg src={ct.portraitBase64} />
                    <div className={styles.featureCardOverlay}>
                      <div className={styles.featureCardInfo}>
                        <div className={styles.featureTitle}>{ct.name}</div>
                        <div className={styles.featurePersonality}>{ct.personality || ct.background || '角色模板'}</div>
                        <div className={styles.featureDesc}>{ct.background || '暂无背景故事'}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.cardStatusTag}
                      style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
                      disabled={alreadyLocal}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const data = await pullTemplate(ct.id);
                        if (!data) { useToastStore.getState().show('拉取失败', 'error'); return; }
                        try {
                          const parsed = JSON.parse(data.payload);
                          const templateId = parsed.id || ct.id;
                          let portraitPath = parsed.portraitPath;
                          let portraitFullPath = parsed.portraitFullPath;
                          if (parsed.portraitBase64) {
                            try {
                              portraitPath = await window.api.files.saveBase64Image(
                                parsed.portraitBase64,
                                `portraits/${templateId}`
                              );
                            } catch (e) { console.warn('保存头像失败', e); }
                          }
                          if (parsed.portraitFullBase64) {
                            try {
                              portraitFullPath = await window.api.files.saveBase64Image(
                                parsed.portraitFullBase64,
                                `portraits/${templateId}-full`
                              );
                            } catch (e) { console.warn('保存全身像失败', e); }
                          }
                          await saveTemplate({
                            id: templateId,
                            name: parsed.name || ct.name,
                            gender: parsed.gender,
                            occupation: parsed.occupation,
                            personality: parsed.personality,
                            background: parsed.background,
                            body: parsed.body,
                            openingStory: parsed.openingStory,
                            portraitPath,
                            portraitFullPath,
                            statusFieldEnabled: parsed.statusFieldEnabled,
                            statusFields: parsed.statusFields,
                          });
                          await loadAll();
                          useToastStore.getState().show(`「${ct.name}」已恢复到本地，可在角色扮演模式中使用`, 'success');
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : '解析模板数据失败';
                          useToastStore.getState().show(`恢复模板失败: ${msg}`, 'error');
                          console.error(e);
                        }
                      }}
                    >
                      {alreadyLocal ? '已同步' : '☁ 恢复'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.shareBtn} ${ct.shared ? styles.shareBtnActive : ''}`}
                      title={ct.shared ? '已分享到广场，点击取消' : '分享到广场'}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const shared = await toggleTemplateShared(ct.id);
                        if (shared === null) {
                          useToastStore.getState().show('操作失败', 'error');
                        } else {
                          useToastStore.getState().show(shared ? '已分享到广场' : '已取消分享', 'success');
                          void loadCloudTemplates();
                          void loadTemplates();
                        }
                      }}
                    >
                      <IconShare />
                    </button>
                    <button
                      type="button"
                      className={styles.cloudDeleteBtn}
                      title="删除云端模板"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`确定删除云端模板「${ct.name}」？`)) return;
                        const ok = await deleteCloudTemplate(ct.id);
                        if (ok) {
                          useToastStore.getState().show(`已删除「${ct.name}」`, 'success');
                          void loadCloudTemplates();
                        } else {
                          useToastStore.getState().show('删除失败', 'error');
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {cloudTemplates.length === 0 && (
                <div className={styles.emptyCard}>暂无云端模板，可在角色扮演模式中上传</div>
              )}
            </div>
          </div>
        );
      case 'history':
        return (
          <div className={styles.pageScroll}>
            <div className={styles.pageHeader}>
              <h2>☁ 云端会话</h2>
              <span className={styles.pageSub}>共 {cloudSessions.length} 个，可恢复到本地</span>
            </div>
            {cloudError && (
              <div style={{ padding: '0 16px', fontSize: 12, color: '#fca5a5' }}>⚠ {cloudError}</div>
            )}
            <div className={styles.cloudList}>
              {cloudSessions.map(cs => {
                const alreadyLocal = sessions.some(s => s.id === cs.id);
                return (
                  <div key={cs.id} className={styles.cloudItem}>
                    <div className={styles.cloudItemInfo}>
                      <div className={styles.cloudItemTitle}>{cs.title}</div>
                      <div className={styles.cloudItemMeta}>{cs.messageCount} 条消息 · {cs.updatedAt && !isNaN(Number(cs.updatedAt)) ? new Date(Number(cs.updatedAt)).toLocaleString('zh-CN') : ''}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.cloudItemAction}
                      disabled={alreadyLocal}
                      onClick={async () => {
                        const data = await pullSession(cs.id);
                        if (!data) { useToastStore.getState().show('拉取失败', 'error'); return; }
                        try {
                          await window.api.sessions.save(cs.id, cs.title || '恢复会话', data.payload);
                          await useChatStore.getState().loadSessions();
                          useToastStore.getState().show(`「${cs.title}」已恢复到本地，可在聊天面板中查看`, 'success');
                        } catch {
                          useToastStore.getState().show('解析会话数据失败', 'error');
                        }
                      }}
                    >
                      {alreadyLocal ? '已同步' : '恢复到本地'}
                    </button>
                    <button
                      type="button"
                      className={styles.cloudDeleteBtn}
                      style={{ position: 'static', marginLeft: 8 }}
                      title="删除云端会话"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`确定删除云端会话「${cs.title}」？`)) return;
                        const ok = await deleteCloudSession(cs.id);
                        if (ok) {
                          useToastStore.getState().show(`已删除「${cs.title}」`, 'success');
                          void loadCloudSessions();
                        } else {
                          useToastStore.getState().show('删除失败', 'error');
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {cloudSessions.length === 0 && (
                <div className={styles.emptyCard}>暂无云端会话，可在聊天面板中上传</div>
              )}
            </div>
          </div>
        );
      case 'square':
        return <SquarePanel onClose={onClose} />;
      case 'favorites':
        return (
          <div className={styles.pageScroll}>
            <div className={styles.pageHeader}>
              <h2>我的收藏</h2>
              <span className={styles.pageSub}>共 {favorites.length} 个收藏</span>
            </div>
            {favorites.length === 0 ? (
              <div className={styles.emptyCard}>暂无收藏，在角色广场中点击 🔖 收藏角色</div>
            ) : (
              <div className={styles.cardGridCharacters}>
                {favorites.map(f => {
                  const alreadyLocal = characters.some(c => c.id === f.id);
                  const isUnshared = !f.shared;
                  return (
                    <div
                      key={f.id}
                      className={`${styles.featureCard} ${styles.characterCard} ${isUnshared ? styles.characterCardUnshared : ''}`}
                      onClick={() => {
                        if (isUnshared) return;
                        const full = f.portraitFullBase64 || f.portraitBase64;
                        if (full) { setFullImageSrc(full); setShowFullImage(true); }
                      }}
                    >
                      <PortraitBg src={f.portraitBase64} />
                      <div className={styles.featureCardOverlay}>
                        <div className={styles.featureCardInfo}>
                          <div className={styles.featureTitle}>{f.name}</div>
                          <div className={styles.featurePersonality}>
                            {isUnshared ? '作者已取消分享' : (f.personality || f.background || '角色')}
                          </div>
                          <div className={styles.featureDesc}>by {f.userName}</div>
                        </div>
                      </div>
                      {/* top-right: unshared badge or unfavorite button */}
                      {isUnshared ? (
                        <div className={styles.unsharedBadge}>已取消分享</div>
                      ) : (
                        <button
                          type="button"
                          className={styles.favRestoreBtn}
                          disabled={alreadyLocal}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const data = await pullCharacter(f.id);
                            if (!data) { useToastStore.getState().show('拉取失败', 'error'); return; }
                            try {
                              const parsed = JSON.parse(data.payload);
                              const characterId = parsed.id || f.id;
                              let portraitPath: string | undefined;
                              let portraitFullPath: string | undefined;
                              if (parsed.portraitBase64) {
                                try { portraitPath = await window.api.files.saveBase64Image(parsed.portraitBase64, `portraits/${characterId}`); } catch (e) { console.warn('保存头像失败', e); }
                              }
                              if (parsed.portraitFullBase64) {
                                try { portraitFullPath = await window.api.files.saveBase64Image(parsed.portraitFullBase64, `portraits/${characterId}-full`); } catch (e) { console.warn('保存全身像失败', e); }
                              }
                              await saveCharacter({
                                id: characterId, templateId: parsed.templateId, name: parsed.name || f.name,
                                gender: parsed.gender, occupation: parsed.occupation, personality: parsed.personality,
                                background: parsed.background, body: parsed.body, openingStory: parsed.openingStory,
                                portraitPath, portraitFullPath,
                                statusFieldEnabled: parsed.statusFieldEnabled, statusFields: parsed.statusFields,
                              });
                              await loadAll();
                              useToastStore.getState().show(`「${f.name}」已恢复到本地`, 'success');
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : '解析角色数据失败';
                              useToastStore.getState().show(`恢复角色失败: ${msg}`, 'error');
                            }
                          }}
                        >
                          {alreadyLocal ? '已在本地' : '⬇ 恢复'}
                        </button>
                      )}
                      {/* bottom-right: remove favorite */}
                      <button
                        type="button"
                        className={styles.favRemoveBtn}
                        title="取消收藏"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await toggleFavorite(f.id);
                          await loadFavorites();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <button type="button" className={styles.backBtn} onClick={onClose} title="返回工作区">←</button>
          <span className={styles.sidebarTitle}>账户中心</span>
        </div>
        <nav className={styles.nav}>
          {mainNav.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${section === item.id ? styles.navActive : ''}`}
              onClick={() => setSection(item.id)}
            >
              <item.icon className={styles.navIcon} />
              {item.label}
            </button>
          ))}
        </nav>
        {isLoggedIn && user && (
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>
              {user.avatar ? (
                <img src={user.avatar} alt="" className={styles.sidebarAvatarImg} />
              ) : (
                user.username[0]?.toUpperCase()
              )}
            </div>
            <div>
              <div className={styles.sidebarUserName}>{user.username}</div>
              <div className={styles.sidebarUserSub}>已登录</div>
            </div>
          </div>
        )}
      </aside>
      <main className={styles.main}>
        {renderContent()}
      </main>

      {showFullImage && fullImageSrc && (
        <div
          className={styles.fullImageOverlay}
          onClick={() => setShowFullImage(false)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={fullImageSrc}
            alt="角色大图"
            className={styles.fullImage}
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            className={styles.fullImageClose}
            onClick={() => setShowFullImage(false)}
          >
            ×
          </button>
        </div>
      )}


    </div>
  );
}
