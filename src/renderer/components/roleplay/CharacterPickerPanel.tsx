import React, { useEffect, useState } from 'react';
import { useRoleplayStore } from '../../stores/roleplay';
import { useModeStore } from '../../stores/mode';
import { useChatStore } from '../../stores/chat';
import type { RoleplayCharacter } from '../../utils/roleplay';
import styles from './CharacterPickerPanel.module.css';

function PortraitImage({ path }: { path?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    void window.api.files.readBinary(path).then(url => {
      if (!cancelled) setSrc(url);
    }).catch(() => {
      if (!cancelled) setSrc(null);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (src) {
    return <img src={src} alt="" className={styles.portraitImg} />;
  }
  return <div className={styles.portraitPlaceholder}>暂无立绘</div>;
}

export default function CharacterPickerPanel() {
  const {
    characters,
    activeCharacterId,
    loading,
    error,
    loadAll,
    setActiveCharacter,
  } = useRoleplayStore();
  const setMode = useModeStore(s => s.setMode);
  const bindSessionCharacter = useChatStore(s => s.setSessionCharacter);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectCharacter = async (character: RoleplayCharacter) => {
    if (character.id === activeCharacterId) return;
    setMode('roleplay');
    await setActiveCharacter(character.id);
    bindSessionCharacter(character.id);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>角色</div>
        <div className={styles.subtitle}>悬停卡片并选择，切换当前对话角色</div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && characters.length === 0 && <div className={styles.hint}>加载中…</div>}

      <div className={styles.list}>
        {characters.map(character => {
          const isActive = character.id === activeCharacterId;
          return (
            <div
              key={character.id}
              className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
            >
              <div className={styles.portraitWrap}>
                <PortraitImage path={character.portraitPath} />
                <div className={styles.hoverOverlay}>
                  <button
                    type="button"
                    className={`${styles.selectBtn} ${isActive ? styles.selectBtnActive : ''}`}
                    onClick={() => void selectCharacter(character)}
                    disabled={isActive}
                  >
                    {isActive ? '已选中' : '选择'}
                  </button>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.name}>{character.name}</div>
                <div className={styles.background}>
                  {character.background?.trim() || '暂无背景描述'}
                </div>
              </div>
            </div>
          );
        })}
        {!loading && characters.length === 0 && (
          <div className={styles.empty}>
            暂无角色。可在「系统设置 → 角色管理」中创建。
          </div>
        )}
      </div>
    </div>
  );
}
