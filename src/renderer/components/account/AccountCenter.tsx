import React, { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useSyncStore } from '../../stores/sync';
import { useChatStore } from '../../stores/chat';
import { useRoleplayStore } from '../../stores/roleplay';
import AccountAuthForm from './AccountAuthForm';
import CharacterEditor from '../roleplay/CharacterEditor';
import {
  buildCharacterStatusEnabledMap,
  getTemplateById,
  type CharacterFormData,
  type RoleplayCharacter,
  type RoleplayTemplate,
} from '../../utils/roleplay';
import styles from './AccountCenter.module.css';

function PortraitBg({ path }: { path?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setSrc(null); return; }
    let cancelled = false;
    void window.api.files.readBinary(path).then(url => {
      if (!cancelled) setSrc(url);
    }).catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [path]);
  if (src) {
    return <div className={styles.portraitBg} style={{ backgroundImage: `url(${src})` }} />;
  }
  return (
    <div className={styles.portraitBgEmpty}>
      <span className={styles.portraitPlaceholder}>{path ? '…' : '?'}</span>
    </div>
  );
}

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

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

export default function AccountCenter({ onClose }: Props) {
  const { user, status, logout, updateProfile, error: authError, clearError } = useAuthStore();
  const sessions = useChatStore(s => s.sessions);
  const {
    characters, templates, loadAll,
    saveCharacter, pickPortrait, generatePortrait,
  } = useRoleplayStore();
  const [section, setSection] = useState<AccountSection>('overview');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const [editingCharacter, setEditingCharacter] = useState<{
    data: CharacterFormData;
    template: RoleplayTemplate | null;
  } | null>(null);
  const [dirtyCharacterIds, setDirtyCharacterIds] = useState<Set<string>>(new Set());
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const isLoggedIn = status === 'authenticated' && user;

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const recentSessions = useMemo(
    () => [...sessions]
      .sort((a, b) => {
        const ta = a.messages[a.messages.length - 1]?.timestamp ?? 0;
        const tb = b.messages[b.messages.length - 1]?.timestamp ?? 0;
        return tb - ta;
      })
      .slice(0, 5),
    [sessions],
  );

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
                <div className={styles.statLabel}>角色卡片</div>
                <div className={styles.statValue}>{characters.length}</div>
                <div className={styles.statSub}>已创建</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>模板</div>
                <div className={styles.statValue}>{templates.length}</div>
                <div className={styles.statSub}>已创建</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>对话</div>
                <div className={styles.statValue}>{sessions.length}</div>
                <div className={styles.statSub}>本地会话</div>
              </div>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>收藏</div>
                <div className={styles.statValue}>0</div>
                <div className={styles.statSub}>即将推出</div>
              </div>
            </div>
          </section>

        <section className={styles.sectionBlock}>
          <div className={styles.sectionHead}>
            <h2>角色卡片</h2>
            <button type="button" className={styles.linkBtn} onClick={() => setSection('characters')}>查看全部 →</button>
          </div>
          <div className={styles.cardGridCharacters}>
            {characters.slice(0, 3).map(c => (
              <div
                key={c.id}
                className={`${styles.featureCard} ${styles.characterCard}`}
                onClick={async () => {
                  const targetPath = c.portraitFullPath || c.portraitPath;
                  if (!targetPath) return;
                  try {
                    const url = await window.api.files.readBinary(targetPath);
                    setFullImageSrc(url);
                    setShowFullImage(true);
                  } catch {
                    // ignore
                  }
                }}
              >
                <PortraitBg path={c.portraitPath} />
                <div className={styles.featureCardOverlay}>
                  <div className={styles.featureCardInfo}>
                    <div className={styles.featureTitle}>{c.name}</div>
                    <div className={styles.featurePersonality}>{c.personality || c.occupation || '角色'}</div>
                    <div className={styles.featureDesc}>{c.background || '暂无背景故事'}</div>
                  </div>
                </div>
              </div>
            ))}
            {characters.length === 0 && (
              <div className={styles.emptyCard}>暂无角色，可在角色扮演模式中创建</div>
            )}
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
          <div className={styles.sectionHead}><h2>对话历史</h2></div>
          <div className={styles.historyList}>
            {recentSessions.map(s => {
              const ts = s.messages[s.messages.length - 1]?.timestamp ?? Date.now();
              return (
                <div key={s.id} className={styles.historyItem}>
                  <div className={styles.historyTitle}>{s.title || '未命名会话'}</div>
                  <div className={styles.historyMeta}>
                    <span className={styles.tagMuted}>{s.sessionMode === 'roleplay' ? '角色扮演' : 'Agent'}</span>
                    <span>{formatRelative(ts)}</span>
                  </div>
                </div>
              );
            })}
            {recentSessions.length === 0 && <div className={styles.emptyCard}>暂无对话记录</div>}
          </div>
        </section>
        </div>

        <div className={styles.floatingSync}>
          <section className={styles.widgetCard}>
            <div className={styles.widgetHead}><span>↻</span><h3>同步状态</h3></div>
            <div className={styles.syncOk}>○ 本地数据就绪</div>
            <div className={styles.widgetSub}>云端会话同步已就绪</div>
            <div className={styles.widgetSub}>最后活动 {lastMsgTs ? formatRelative(lastMsgTs) : '—'}</div>
            <button
              type="button"
              className={styles.primaryBtnSmall}
              onClick={() => {
                const { loadCloudSessions } = useSyncStore.getState();
                void loadCloudSessions();
                alert('已刷新云端会话列表。\n\n上传数据请去：\n• 对话历史侧栏的 ☁ 按钮 → 上传会话\n• 角色卡片编辑后 → 点击 ☁ 同步按钮');
              }}
            >
              刷新云端列表
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
              <h2>角色卡片</h2>
              <span className={styles.pageSub}>共 {characters.length} 个角色</span>
            </div>
            <div className={styles.cardGridCharacters}>
              {characters.map(c => {
                const isDirty = dirtyCharacterIds.has(c.id);
                const isSyncing = syncingId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`${styles.featureCard} ${styles.characterCard}`}
                    onClick={async () => {
                      const targetPath = c.portraitFullPath || c.portraitPath;
                      if (!targetPath) return;
                      try {
                        const url = await window.api.files.readBinary(targetPath);
                        setFullImageSrc(url);
                        setShowFullImage(true);
                      } catch { /* ignore */ }
                    }}
                  >
                    <div className={styles.cardTopActions}>
                      <button
                        type="button"
                        className={styles.cardActionIcon}
                        title="编辑角色"
                        onClick={e => {
                          e.stopPropagation();
                          const tpl = getTemplateById(templates, c.templateId);
                          setEditingCharacter({
                            data: { ...c, statusFieldEnabled: buildCharacterStatusEnabledMap(c, tpl) },
                            template: tpl,
                          });
                        }}
                      >
                        ✎
                      </button>
                      {isDirty && (
                        <button
                          type="button"
                          className={`${styles.cardActionIcon} ${styles.cardActionSync}`}
                          title="同步到云端"
                          disabled={isSyncing}
                          onClick={async e => {
                            e.stopPropagation();
                            setSyncingId(c.id);
                            try {
                              const payload = JSON.stringify({
                                name: c.name,
                                gender: c.gender,
                                occupation: c.occupation,
                                personality: c.personality,
                                background: c.background,
                                body: c.body,
                                openingStory: c.openingStory,
                                portraitPath: c.portraitPath,
                                portraitFullPath: c.portraitFullPath,
                                statusFieldEnabled: c.statusFieldEnabled,
                              });
                              const res = await window.api.sync.pushCharacter(c.id, c.name, payload);
                              if (res.success) {
                                setDirtyCharacterIds(prev => {
                                  const next = new Set(prev);
                                  next.delete(c.id);
                                  return next;
                                });
                              } else {
                                alert(`同步失败：${res.error}`);
                              }
                            } finally {
                              setSyncingId(null);
                            }
                          }}
                        >
                          {isSyncing ? '⋯' : '☁'}
                        </button>
                      )}
                    </div>
                    <PortraitBg path={c.portraitPath} />
                    <div className={styles.featureCardOverlay}>
                      <div className={styles.featureCardInfo}>
                        <div className={styles.featureTitle}>{c.name}</div>
                        <div className={styles.featurePersonality}>{c.personality || c.occupation || '角色'}</div>
                        <div className={styles.featureDesc}>{c.background || '暂无背景故事'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {characters.length === 0 && (
                <div className={styles.emptyCard}>暂无角色，可在角色扮演模式中创建</div>
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
              <h2>对话历史</h2>
              <span className={styles.pageSub}>共 {sessions.length} 个本地会话</span>
            </div>
            <div className={styles.historyListFull}>
              {sessions.map(s => {
                const lastMsg = s.messages[s.messages.length - 1];
                const ts = lastMsg?.timestamp ?? 0;
                return (
                  <div key={s.id} className={styles.historyItem}>
                    <div className={styles.historyTitle}>{s.title || '未命名会话'}</div>
                    <div className={styles.historyMeta}>
                      <span className={styles.tagMuted}>{s.sessionMode === 'roleplay' ? '角色扮演' : 'Agent'}</span>
                      <span>{s.messages.length} 条消息</span>
                      <span>{ts ? formatRelative(ts) : '—'}</span>
                    </div>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <div className={styles.emptyCard}>暂无对话记录</div>
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
            <div className={styles.sidebarAvatar}>{user.username[0]?.toUpperCase()}</div>
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

      {editingCharacter && (
        <CharacterEditor
          title="编辑角色"
          editorMode="character"
          template={editingCharacter.template}
          initial={editingCharacter.data}
          draftId={editingCharacter.data.id || `draft-${Date.now()}`}
          onPickPortrait={pickPortrait}
          onGeneratePortrait={generatePortrait}
          onCancel={() => setEditingCharacter(null)}
          onSave={async (data) => {
            const saved = await saveCharacter(data);
            if (saved) {
              setEditingCharacter(null);
              setDirtyCharacterIds(prev => {
                const next = new Set(prev);
                next.add(saved.id);
                return next;
              });
            }
          }}
        />
      )}
    </div>
  );
}
