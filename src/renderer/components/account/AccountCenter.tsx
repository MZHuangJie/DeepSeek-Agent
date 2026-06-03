import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useSyncStore } from '../../stores/sync';
import { useChatStore } from '../../stores/chat';
import { useRoleplayStore } from '../../stores/roleplay';
import { useSquareStore } from '../../stores/square';
import AccountAuthForm from './AccountAuthForm';
import SquarePanel from './SquarePanel';
import OverviewSection from './OverviewSection';
import CloudCardSection, { restoreCharacterFromCloud } from './CloudCardSection';
import CloudSessionsSection from './CloudSessionsSection';
import FavoritesSection from './FavoritesSection';
import { useConfirmStore } from '../../stores/confirm';
import { useToastStore } from '../../stores/toast';
import { IconOverview, IconCharacter, IconTemplate, IconChat, IconStar, IconSquare } from './AccountIcons';
import styles from './AccountCenter.module.css';

export type AccountSection = 'overview' | 'characters' | 'templates' | 'history' | 'favorites' | 'square';

interface NavItem {
  id: AccountSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV: NavItem[] = [
  { id: 'overview', label: '账户概览', icon: IconOverview },
  { id: 'characters', label: '角色卡片', icon: IconCharacter },
  { id: 'templates', label: '我的模板', icon: IconTemplate },
  { id: 'history', label: '对话历史', icon: IconChat },
  { id: 'favorites', label: '收藏夹', icon: IconStar },
  { id: 'square', label: '角色广场', icon: IconSquare },
];

interface Props { onClose: () => void; }

export default function AccountCenter({ onClose }: Props) {
  const { user, status, logout, updateProfile, error: authError, clearError } = useAuthStore();
  const sessions = useChatStore(s => s.sessions);
  const { characters, templates, loadAll, saveCharacter, saveTemplate } = useRoleplayStore();
  const {
    cloudSessions, cloudCharacters, cloudTemplates, loading: cloudLoading, error: cloudError,
    loadCloudSessions, loadCloudCharacters, loadCloudTemplates,
    pullCharacter, pullSession, pullTemplate,
    deleteCloudCharacter, deleteCloudSession, deleteCloudTemplate,
  } = useSyncStore();
  const { favorites, loadFavorites, toggleFavorite, toggleCharacterShared, toggleTemplateShared, loadCharacters, loadTemplates } = useSquareStore();
  const [section, setSection] = useState<AccountSection>('overview');
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  const isLoggedIn = status === 'authenticated' && user;

  useEffect(() => {
    void loadAll();
    if (!isLoggedIn) return;
    (async () => {
      try { await loadCloudSessions(); } catch (e) { console.error('[AccountCenter] loadCloudSessions failed:', e); }
      try { await loadCloudCharacters(); } catch (e) { console.error('[AccountCenter] loadCloudCharacters failed:', e); }
      try { await loadCloudTemplates(); } catch (e) { console.error('[AccountCenter] loadCloudTemplates failed:', e); }
      try { await loadFavorites(); } catch (e) { console.error('[AccountCenter] loadFavorites failed:', e); }
    })();
  }, [loadAll, loadCloudSessions, loadCloudCharacters, loadCloudTemplates, loadFavorites, isLoggedIn]);

  const localCharacterIds = new Set(characters.map(c => c.id));
  const localTemplateIds = new Set(templates.map(t => t.id));
  const localSessionIds = new Set(sessions.map(s => s.id));

  const handleImagePreview = (src: string | null) => { setFullImageSrc(src); setShowFullImage(!!src); };

  const renderContent = () => {
    if (!isLoggedIn) return <AccountAuthForm />;
    switch (section) {
      case 'overview':
        return (
          <OverviewSection
            user={user} sessions={sessions}
            cloudCharacters={cloudCharacters} cloudTemplates={cloudTemplates}
            cloudSessions={cloudSessions} cloudLoading={cloudLoading}
            authError={authError} clearError={clearError}
            updateProfile={async (u) => { void updateProfile(u); }}
            logout={logout}
            loadCloudSessions={loadCloudSessions} loadCloudCharacters={loadCloudCharacters}
            loadCloudTemplates={loadCloudTemplates} loadFavorites={loadFavorites}
            onNavigate={setSection} onImagePreview={handleImagePreview}
          />
        );
      case 'characters':
        return (
          <CloudCardSection
            title="☁ 云端角色" subtitle="可恢复到本地"
            items={cloudCharacters} error={cloudError} isCharacter={true}
            localIds={localCharacterIds}
            onRestore={async (item) => {
              await restoreCharacterFromCloud(item, pullCharacter, saveCharacter as any, loadAll);
            }}
            onToggleShare={toggleCharacterShared}
            onDelete={(id, name) => useConfirmStore.getState().show({
              message: `确定删除云端角色「${name}」？`,
              onConfirm: async () => {
                const ok = await deleteCloudCharacter(id);
                useToastStore.getState().show(ok ? `已删除「${name}」` : '删除失败', ok ? 'success' : 'error');
                if (ok) void loadCloudCharacters();
              },
            })}
            onImagePreview={handleImagePreview}
            onReloadItems={() => { void loadCloudCharacters(); void loadCharacters(); }}
          />
        );
      case 'templates':
        return (
          <CloudCardSection
            title="☁ 云端模板" subtitle="可恢复到本地"
            items={cloudTemplates} error={cloudError} isCharacter={false}
            localIds={localTemplateIds}
            onRestore={async (item) => {
              await restoreCharacterFromCloud(item, pullTemplate as any, saveTemplate as any, () => { void loadAll(); });
            }}
            onToggleShare={toggleTemplateShared}
            onDelete={(id, name) => useConfirmStore.getState().show({
              message: `确定删除云端模板「${name}」？`,
              onConfirm: async () => {
                const ok = await deleteCloudTemplate(id);
                useToastStore.getState().show(ok ? `已删除「${name}」` : '删除失败', ok ? 'success' : 'error');
                if (ok) void loadCloudTemplates();
              },
            })}
            onImagePreview={handleImagePreview}
            onReloadItems={() => { void loadCloudTemplates(); void loadTemplates(); }}
          />
        );
      case 'history':
        return (
          <CloudSessionsSection
            sessions={cloudSessions} localIds={localSessionIds} error={cloudError}
            pullSession={pullSession} deleteCloudSession={deleteCloudSession}
            loadCloudSessions={loadCloudSessions}
          />
        );
      case 'square':
        return <SquarePanel onClose={onClose} />;
      case 'favorites':
        return (
          <FavoritesSection
            favorites={favorites} localCharacterIds={localCharacterIds}
            pullCharacter={pullCharacter} toggleFavorite={toggleFavorite}
            loadFavorites={loadFavorites} onImagePreview={handleImagePreview}
          />
        );
      default:
        return null;
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
          {NAV.map(item => (
            <button key={item.id} type="button"
              className={`${styles.navItem} ${section === item.id ? styles.navActive : ''}`}
              onClick={() => setSection(item.id)}>
              <item.icon className={styles.navIcon} />
              {item.label}
            </button>
          ))}
        </nav>
        {isLoggedIn && user && (
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>
              {user.avatar ? <img src={user.avatar} alt="" className={styles.sidebarAvatarImg} /> : user.username[0]?.toUpperCase()}
            </div>
            <div>
              <div className={styles.sidebarUserName}>{user.username}</div>
              <div className={styles.sidebarUserSub}>已登录</div>
            </div>
          </div>
        )}
      </aside>
      <main className={styles.main}>{renderContent()}</main>

      {showFullImage && fullImageSrc && (
        <div className={styles.fullImageOverlay} onClick={() => setShowFullImage(false)} role="dialog" aria-modal="true">
          <img src={fullImageSrc} alt="角色大图" className={styles.fullImage} onClick={e => e.stopPropagation()} />
          <button type="button" className={styles.fullImageClose} onClick={() => setShowFullImage(false)}>×</button>
        </div>
      )}
    </div>
  );
}
