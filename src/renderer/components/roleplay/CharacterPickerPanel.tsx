import React, { useEffect, useMemo, useState } from 'react';
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
    draftParticipantIds,
    loading,
    error,
    loadAll,
    setActiveCharacter,
    setSessionCast,
    toggleDraftParticipant,
  } = useRoleplayStore();
  const { mode, setMode } = useModeStore();
  const isRoleplayMode = mode === 'roleplay';
  const { setSessionCharacter, setSessionCast: bindSessionCast, createSession, activeSessionId } = useChatStore();

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const isMultiDraft = draftParticipantIds.length >= 2;

  const selectSingleCharacter = async (character: RoleplayCharacter) => {
    setMode('roleplay');
    await setActiveCharacter(character.id);
    if (!useChatStore.getState().activeSessionId) {
      createSession();
    }
    setSessionCharacter(character.id, {
      sessionMode: 'roleplay',
      pendingOpening: true,
    });
  };

  const startGroupChat = async () => {
    if (!isMultiDraft) return;
    setMode('roleplay');
    await setSessionCast(draftParticipantIds);
    if (activeSessionId) {
      bindSessionCast(draftParticipantIds);
    } else {
      createSession();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>角色</div>
        <div className={styles.subtitle}>
          角色扮演：单选 1v1；多选 2 人以上开启群聊，你以本人身份与 NPC 互动
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && characters.length === 0 && <div className={styles.hint}>加载中…</div>}

      {isRoleplayMode && draftParticipantIds.length > 0 && (
        <div className={styles.castBar}>
          <span className={styles.castSummary}>已选 {draftParticipantIds.length} 人</span>
          {isMultiDraft && (
            <button type="button" className={styles.groupBtn} onClick={() => void startGroupChat()}>
              开始群聊
            </button>
          )}
        </div>
      )}

      <div className={styles.list}>
        {characters.map(character => {
          const isSelected = draftParticipantIds.includes(character.id);
          const isActiveSingle = character.id === activeCharacterId && draftParticipantIds.length <= 1;
          return (
            <div
              key={character.id}
              className={`${styles.card} ${isSelected ? styles.cardActive : ''}`}
            >
              <div className={styles.cardTopBar}>
                {isRoleplayMode && (
                  <label className={styles.joinCheck}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDraftParticipant(character.id)}
                    />
                    加入场景
                  </label>
                )}
              </div>
              <div className={styles.portraitWrap}>
                <PortraitImage path={character.portraitPath} />
                <div className={styles.hoverOverlay}>
                  <button
                    type="button"
                    className={`${styles.selectBtn} ${isActiveSingle ? styles.selectBtnActive : ''}`}
                    onClick={() => void selectSingleCharacter(character)}
                    disabled={isActiveSingle}
                  >
                    {isActiveSingle ? '已选中' : '1v1 选择'}
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
