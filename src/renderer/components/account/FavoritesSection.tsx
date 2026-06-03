import React from 'react';
import styles from './AccountCenter.module.css';
import { PortraitBg } from './AccountIcons';
import { useToastStore } from '../../stores/toast';
import { useRoleplayStore } from '../../stores/roleplay';

interface FavoriteItem {
  id: string;
  name: string;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  shared: boolean;
  userName?: string;
}

interface Props {
  favorites: FavoriteItem[];
  localCharacterIds: Set<string>;
  pullCharacter: (id: string) => Promise<{ payload: string } | null>;
  toggleFavorite: (id: string) => Promise<boolean | null>;
  loadFavorites: () => Promise<void>;
  onImagePreview: (src: string | null) => void;
}

export default function FavoritesSection({ favorites, localCharacterIds, pullCharacter, toggleFavorite, loadFavorites, onImagePreview }: Props) {
  const { saveCharacter, loadAll } = useRoleplayStore();

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
            const alreadyLocal = localCharacterIds.has(f.id);
            const isUnshared = !f.shared;
            return (
              <div key={f.id} className={`${styles.featureCard} ${styles.characterCard} ${isUnshared ? styles.characterCardUnshared : ''}`}
                onClick={() => {
                  if (isUnshared) return;
                  const full = f.portraitFullBase64 || f.portraitBase64;
                  if (full) onImagePreview(full);
                }}>
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
                {isUnshared ? (
                  <div className={styles.unsharedBadge}>已取消分享</div>
                ) : (
                  <button type="button" className={styles.favRestoreBtn} disabled={alreadyLocal}
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
                    }}>
                    {alreadyLocal ? '已在本地' : '⬇ 恢复'}
                  </button>
                )}
                <button type="button" className={styles.favRemoveBtn} title="取消收藏"
                  onClick={async (e) => { e.stopPropagation(); await toggleFavorite(f.id); await loadFavorites(); }}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
