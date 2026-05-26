import React, { useEffect, useState } from 'react';
import { useRoleplayStore } from '../../stores/roleplay';
import { useModeStore } from '../../stores/mode';
import { useChatStore } from '../../stores/chat';
import CharacterEditor from './CharacterEditor';
import {
  emptyCharacterForm,
  characterFromTemplate,
  type CharacterFormData,
  type RoleplayCharacter,
  type RoleplayTemplate,
} from '../../utils/roleplay';
import styles from './CharacterPanel.module.css';

function PortraitThumb({ path }: { path?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setSrc(null); return; }
    let cancelled = false;
    void window.api.files.readBinary(path).then(url => {
      if (!cancelled) setSrc(url);
    }).catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [path]);
  return (
    <div className={styles.thumb}>
      {src ? <img src={src} alt="" className={styles.thumbImg} /> : <span className={styles.thumbPlaceholder}>RP</span>}
    </div>
  );
}

interface Props {
  embedded?: boolean;
  onClose?: () => void;
}

export default function CharacterPanel({ embedded, onClose }: Props) {
  const {
    templates,
    characters,
    activeCharacterId,
    loading,
    error,
    loadAll,
    saveCharacter,
    deleteCharacter,
    createFromTemplate,
    saveTemplate,
    deleteTemplate,
    setActiveCharacter,
    pickPortrait,
    generatePortrait,
  } = useRoleplayStore();
  const setMode = useModeStore(s => s.setMode);
  const bindSessionCharacter = useChatStore(s => s.setSessionCharacter);

  const [tab, setTab] = useState<'characters' | 'templates'>('characters');
  const [editor, setEditor] = useState<
    | { kind: 'character'; data: CharacterFormData }
    | { kind: 'template'; data: CharacterFormData & { id?: string } }
    | null
  >(null);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const selectCharacter = async (character: RoleplayCharacter) => {
    setMode('roleplay');
    await setActiveCharacter(character.id);
    bindSessionCharacter(character.id);
    onClose?.();
  };

  const openNewCharacter = () => {
    setEditor({ kind: 'character', data: { ...emptyCharacterForm(), id: `char-${Date.now()}` } });
  };

  const openEditCharacter = (character: RoleplayCharacter) => {
    setEditor({ kind: 'character', data: { ...character } });
  };

  const openNewTemplate = () => {
    setEditor({ kind: 'template', data: { ...emptyCharacterForm('新模板'), id: `tpl-${Date.now()}` } });
  };

  const openEditTemplate = (template: RoleplayTemplate) => {
    if (template.isBuiltin) return;
    setEditor({ kind: 'template', data: { ...characterFromTemplate(template), id: template.id } });
  };

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <div className={styles.header}>
          <span className={styles.title}>角色列表</span>
        </div>
      )}

      <div className={styles.tabs}>
        <button type="button" className={tab === 'characters' ? styles.tabActive : styles.tab} onClick={() => setTab('characters')}>我的角色</button>
        <button type="button" className={tab === 'templates' ? styles.tabActive : styles.tab} onClick={() => setTab('templates')}>模板</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.hint}>加载中…</div>}

      {tab === 'characters' && (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} onClick={openNewCharacter}>+ 新建角色</button>
          </div>
          <div className={styles.list}>
            {characters.map(c => (
              <div
                key={c.id}
                className={`${styles.card} ${c.id === activeCharacterId ? styles.cardActive : ''}`}
              >
                <PortraitThumb path={c.portraitPath} />
                <div className={styles.cardMain}>
                  <div className={styles.cardName}>{c.name}</div>
                  <div className={styles.cardMeta}>{[c.gender, c.occupation].filter(Boolean).join(' · ') || '未填写设定'}</div>
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.actionBtn} onClick={() => void selectCharacter(c)}>
                      {c.id === activeCharacterId ? '已选中' : '选择聊天'}
                    </button>
                    <button type="button" className={styles.actionBtn} onClick={() => openEditCharacter(c)}>编辑</button>
                    <button type="button" className={styles.actionBtnDanger} onClick={() => void deleteCharacter(c.id)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
            {characters.length === 0 && !loading && (
              <div className={styles.empty}>暂无角色，可从模板创建或新建</div>
            )}
          </div>
        </>
      )}

      {tab === 'templates' && (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.primaryBtn} onClick={openNewTemplate}>+ 新建模板</button>
          </div>
          <div className={styles.list}>
            {templates.map(t => (
              <div key={t.id} className={styles.card}>
                <PortraitThumb path={t.portraitPath} />
                <div className={styles.cardMain}>
                  <div className={styles.cardName}>
                    {t.name}
                    {t.isBuiltin && <span className={styles.badge}>内置</span>}
                  </div>
                  <div className={styles.cardMeta}>{t.personality || t.background || '通用模板'}</div>
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.actionBtn} onClick={() => void createFromTemplate(t.id).then(c => c && openEditCharacter(c))}>
                      用模板创建
                    </button>
                    {!t.isBuiltin && (
                      <>
                        <button type="button" className={styles.actionBtn} onClick={() => openEditTemplate(t)}>编辑</button>
                        <button type="button" className={styles.actionBtnDanger} onClick={() => void deleteTemplate(t.id)}>删除</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editor?.kind === 'character' && (
        <CharacterEditor
          title={editor.data.id ? '编辑角色' : '新建角色'}
          initial={editor.data}
          draftId={`draft-${Date.now()}`}
          onPickPortrait={pickPortrait}
          onGeneratePortrait={generatePortrait}
          onCancel={() => setEditor(null)}
          onSave={async (data) => {
            const saved = await saveCharacter(data);
            if (saved) {
              setEditor(null);
              if (!activeCharacterId) await selectCharacter(saved);
            }
          }}
        />
      )}

      {editor?.kind === 'template' && (
        <CharacterEditor
          title={editor.data.id ? '编辑模板' : '新建模板'}
          initial={editor.data}
          draftId={`tpl-draft-${Date.now()}`}
          onPickPortrait={pickPortrait}
          onGeneratePortrait={generatePortrait}
          onCancel={() => setEditor(null)}
          onSave={async (data) => {
            const saved = await saveTemplate(data);
            if (saved) setEditor(null);
          }}
        />
      )}
    </div>
  );
}
