import React from 'react';
import styles from './AccountCenter.module.css';
import { PortraitBg, IconShare, IconTrash } from './AccountIcons';
import { useToastStore } from '../../stores/toast';
import { useConfirmStore } from '../../stores/confirm';

interface CloudItem {
  id: string;
  name: string;
  portraitBase64?: string;
  portraitFullBase64?: string;
  personality?: string;
  background?: string;
  shared?: boolean;
}

interface CloudCardSectionProps<T extends CloudItem> {
  title: string;
  subtitle: string;
  items: T[];
  error: string | null;
  isCharacter: boolean;        // true=角色, false=模板
  localIds: Set<string>;       // 已在本地的 ID 集合
  onRestore: (item: T) => Promise<void>;
  onToggleShare: (id: string) => Promise<boolean | null>;
  onDelete: (id: string, name: string) => void;
  onImagePreview: (src: string | null) => void;
  onReloadItems: () => void;
}

export default function CloudCardSection<T extends CloudItem>({
  title, subtitle, items, error, isCharacter, localIds,
  onRestore, onToggleShare, onDelete, onImagePreview, onReloadItems,
}: CloudCardSectionProps<T>) {
  return (
    <div className={styles.pageScroll}>
      <div className={styles.pageHeader}>
        <h2>{title}</h2>
        <span className={styles.pageSub}>共 {items.length} 个，可恢复到本地</span>
      </div>
      {error && (
        <div style={{ padding: '0 16px', fontSize: 12, color: '#fca5a5' }}>⚠ {error}</div>
      )}
      <div className={styles.cardGridCharacters}>
        {items.map(item => {
          const alreadyLocal = localIds.has(item.id);
          return (
            <div key={item.id} className={`${styles.featureCard} ${styles.characterCard}`}
              onClick={() => {
                const full = item.portraitFullBase64 || item.portraitBase64;
                if (full) onImagePreview(full);
              }}>
              <PortraitBg src={item.portraitBase64} />
              <div className={styles.featureCardOverlay}>
                <div className={styles.featureCardInfo}>
                  <div className={styles.featureTitle}>{item.name}</div>
                  <div className={styles.featurePersonality}>{item.personality || item.background || (isCharacter ? '角色' : '角色模板')}</div>
                  <div className={styles.featureDesc}>{item.background || '暂无背景故事'}</div>
                </div>
              </div>
              {/* 恢复按钮 */}
              <button type="button" className={styles.cardStatusTag}
                style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
                disabled={alreadyLocal}
                onClick={async (e) => { e.stopPropagation(); await onRestore(item); }}>
                {alreadyLocal ? '已同步' : '☁ 恢复'}
              </button>
              {/* 分享按钮 */}
              <button type="button"
                className={`${styles.shareBtn} ${item.shared ? styles.shareBtnActive : ''}`}
                title={item.shared ? '已分享到广场，点击取消' : '分享到广场'}
                onClick={async (e) => {
                  e.stopPropagation();
                  const shared = await onToggleShare(item.id);
                  if (shared === null) {
                    useToastStore.getState().show('操作失败', 'error');
                  } else {
                    useToastStore.getState().show(shared ? '已分享到广场' : '已取消分享', 'success');
                    onReloadItems();
                  }
                }}>
                <IconShare />
              </button>
              {/* 删除按钮 */}
              <button type="button" className={styles.cloudDeleteBtn}
                title={`删除云端${isCharacter ? '角色' : '模板'}`}
                onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.name); }}>
                <IconTrash />
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className={styles.emptyCard}>暂无云端{isCharacter ? '角色' : '模板'}，可在角色扮演模式中上传</div>
        )}
      </div>
    </div>
  );
}

/** 云端角色/模板的恢复逻辑 */
export async function restoreCharacterFromCloud(
  item: CloudItem,
  pullFn: (id: string) => Promise<{ name: string; payload: string } | null>,
  saveFn: (data: any) => Promise<void>,
  reloadFn: () => void,
) {
  const data = await pullFn(item.id);
  if (!data) { useToastStore.getState().show('拉取失败', 'error'); return; }
  try {
    const parsed = JSON.parse(data.payload);
    const characterId = parsed.id || item.id;
    let portraitPath = parsed.portraitPath;
    let portraitFullPath = parsed.portraitFullPath;
    if (parsed.portraitBase64) {
      try { portraitPath = await window.api.files.saveBase64Image(parsed.portraitBase64, `portraits/${characterId}`); }
      catch (e) { console.warn('保存头像失败', e); }
    }
    if (parsed.portraitFullBase64) {
      try { portraitFullPath = await window.api.files.saveBase64Image(parsed.portraitFullBase64, `portraits/${characterId}-full`); }
      catch (e) { console.warn('保存全身像失败', e); }
    }
    await saveFn({
      id: characterId, templateId: parsed.templateId,
      name: parsed.name || item.name, gender: parsed.gender, occupation: parsed.occupation,
      personality: parsed.personality, background: parsed.background, body: parsed.body,
      openingStory: parsed.openingStory, portraitPath, portraitFullPath,
      statusFieldEnabled: parsed.statusFieldEnabled, statusFields: parsed.statusFields,
    });
    reloadFn();
    useToastStore.getState().show(`「${item.name}」已恢复到本地，可在角色扮演模式中使用`, 'success');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '解析数据失败';
    useToastStore.getState().show(`恢复失败: ${msg}`, 'error');
    console.error(e);
  }
}
