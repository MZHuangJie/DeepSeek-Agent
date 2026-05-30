import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useSyncStore } from '../../stores/sync';
import { useChatStore } from '../../stores/chat';
import { useRoleplayStore } from '../../stores/roleplay';
import AccountAuthForm from './AccountAuthForm';
import styles from './AccountCenter.module.css';

export type AccountSection =
  | 'overview'
  | 'characters'
  | 'templates'
  | 'history'
  | 'favorites'
  | 'settings'
  | 'api'
  | 'sync'
  | 'about'
  | 'feedback';

interface NavItem {
  id: AccountSection;
  label: string;
  icon: string;
  group?: 'main' | 'footer';
}

const NAV: NavItem[] = [
  { id: 'overview', label: '账户概览', icon: '◫', group: 'main' },
  { id: 'characters', label: '角色卡片', icon: '👤', group: 'main' },
  { id: 'templates', label: '我的模板', icon: '▦', group: 'main' },
  { id: 'history', label: '对话历史', icon: '💬', group: 'main' },
  { id: 'favorites', label: '收藏夹', icon: '★', group: 'main' },
  { id: 'settings', label: '设置', icon: '⚙', group: 'footer' },
  { id: 'api', label: 'API 管理', icon: '⇄', group: 'footer' },
  { id: 'sync', label: '数据与同步', icon: '↻', group: 'footer' },
  { id: 'about', label: '关于', icon: 'ⓘ', group: 'footer' },
  { id: 'feedback', label: '反馈与建议', icon: '✉', group: 'footer' },
];

interface Props {
  onClose: () => void;
}

export default function AccountCenter({ onClose }: Props) {
  const { user, status, logout, updateProfile, error: authError, clearError } = useAuthStore();
  const sessions = useChatStore(s => s.sessions);
  const {
    characters, templates, loadAll, saveCharacter,
  } = useRoleplayStore();
  const {
    cloudSessions, cloudCharacters, loading: cloudLoading, error: cloudError,
    loadCloudSessions, loadCloudCharacters, pullCharacter, pullSession,
  } = useSyncStore();
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
    })();
  }, [loadAll, loadCloudSessions, loadCloudCharacters, isLoggedIn]);

  const mainNav = NAV.filter(n => n.group === 'main');
  const footerNav = NAV.filter(n => n.group === 'footer');

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
              <div className={styles.statCol}>
                <div className={styles.statLabel}>云端角色</div>
                <div className={styles.statValue}>{cloudCharacters.length}</div>
                <div className={styles.statSub}>已同步</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>本地模板</div>
                <div className={styles.statValue}>{templates.length}</div>
                <div className={styles.statSub}>已创建</div>
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
          </section>

        <section className={styles.sectionBlock}>
          <div className={styles.sectionHead}>
            <h2>我的模板</h2>
            <button type="button" className={styles.linkBtn} onClick={() => setSection('templates')}>查看全部 →</button>
          </div>
          <div className={styles.cardGridTemplates}>
            {templates.slice(0, 3).map(t => (
              <div key={t.id} className={styles.templateCard}>
                <div className={styles.templateLeft}>
                  <div className={styles.templateIconBox}>▦</div>
                </div>
                <div className={styles.templateRight}>
                  <div className={styles.templateTitle}>{t.name}</div>
                  <div className={styles.templateDesc}>{t.personality || t.background || '角色模板'}</div>
                  <span className={styles.templateTag}>角色模板</span>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <div className={styles.emptyCard}>暂无模板</div>
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
                  <div className={styles.cloudItemMeta}>{cs.messageCount} 条消息 · {new Date(cs.updatedAt).toLocaleString('zh-CN')}</div>
                </div>
              </div>
            ))}
            {cloudSessions.length === 0 && <div className={styles.emptyCard}>暂无云端会话</div>}
          </div>
        </section>
        </div>

        <div className={styles.floatingSync}>
          <section className={styles.widgetCard}>
            <div className={styles.widgetHead}><span>↻</span><h3>云端同步</h3></div>
            <div className={styles.syncOk}>☁ {cloudCharacters.length} 个角色 · {cloudSessions.length} 个会话</div>
            <div className={styles.widgetSub}>点击刷新查看云端最新数据</div>
            {cloudError && (
              <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 6, wordBreak: 'break-all' }}>
                ⚠ {cloudError}
              </div>
            )}
            <button
              type="button"
              className={styles.primaryBtnSmall}
              disabled={refreshing || cloudLoading}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await Promise.all([loadCloudSessions(), loadCloudCharacters()]);
                } catch (e) {
                  console.error('[AccountCenter] refresh failed:', e);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              {refreshing || cloudLoading ? '刷新中…' : '刷新云端列表'}
            </button>
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
            <div className={styles.cloudList}>
              {cloudCharacters.map(cc => {
                const alreadyLocal = characters.some(c => c.id === cc.id);
                return (
                  <div key={cc.id} className={styles.cloudItem}>
                    <div className={styles.cloudItemInfo}>
                      <div className={styles.cloudItemTitle}>{cc.name}</div>
                      <div className={styles.cloudItemMeta}>{new Date(cc.updatedAt).toLocaleString('zh-CN')}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.cloudItemAction}
                      disabled={alreadyLocal}
                      onClick={async () => {
                        const data = await pullCharacter(cc.id);
                        if (!data) { alert('拉取失败'); return; }
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
                          alert(`「${cc.name}」已恢复到本地，可在角色扮演模式中使用`);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : '解析角色数据失败';
                          alert(`恢复角色失败: ${msg}`);
                          console.error(e);
                        }
                      }}
                    >
                      {alreadyLocal ? '已存在' : '恢复到本地'}
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
              <h2>我的模板</h2>
              <span className={styles.pageSub}>共 {templates.length} 个模板</span>
            </div>
            <div className={styles.cardGridTemplates}>
              {templates.map(t => (
                <div key={t.id} className={styles.templateCard}>
                  <div className={styles.templateLeft}>
                    <div className={styles.templateIconBox}>▦</div>
                  </div>
                  <div className={styles.templateRight}>
                    <div className={styles.templateTitle}>{t.name}</div>
                    <div className={styles.templateDesc}>{t.personality || t.background || '角色模板'}</div>
                    <span className={styles.templateTag}>角色模板</span>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className={styles.emptyCard}>暂无模板</div>
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
                      <div className={styles.cloudItemMeta}>{cs.messageCount} 条消息 · {new Date(cs.updatedAt).toLocaleString('zh-CN')}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.cloudItemAction}
                      disabled={alreadyLocal}
                      onClick={async () => {
                        const data = await pullSession(cs.id);
                        if (!data) { alert('拉取失败'); return; }
                        try {
                          await window.api.sessions.save(cs.id, cs.title || '恢复会话', data.payload);
                          await useChatStore.getState().loadSessions();
                          alert(`「${cs.title}」已恢复到本地，可在聊天面板中查看`);
                        } catch {
                          alert('解析会话数据失败');
                        }
                      }}
                    >
                      {alreadyLocal ? '已存在' : '恢复到本地'}
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
      case 'favorites':
        return renderPlaceholder('收藏夹', '收藏功能即将推出。');
      case 'settings':
        return renderPlaceholder('设置', '请使用左下角系统设置菜单打开主题、模型等配置。');
      case 'api':
        return renderPlaceholder('API 管理', '请在系统设置 → 模型设置 中管理 API Key。');
      case 'sync':
        return renderPlaceholder('数据与同步', '云端会话同步将在 Phase 2 实现。');
      case 'about':
        return renderPlaceholder('关于', 'DeepSeek Agent Desktop IDE');
      case 'feedback':
        return renderPlaceholder('反馈与建议', '反馈渠道即将开放。');
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
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className={styles.navDivider} />
          {footerNav.map(item => (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${section === item.id ? styles.navActive : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
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
