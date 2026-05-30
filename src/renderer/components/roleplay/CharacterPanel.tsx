import React, { useEffect, useState } from 'react';
import { useRoleplayStore } from '../../stores/roleplay';
import { useModeStore } from '../../stores/mode';
import { useChatStore } from '../../stores/chat';
import { useSyncStore } from '../../stores/sync';
import { useAuthStore } from '../../stores/auth';
import CharacterEditor from './CharacterEditor';
import {
  buildCharacterStatusEnabledMap,
  duplicateTemplateForm,
  emptyTemplateForm,
  getTemplateById,
  templateFormFromTemplate,
  type CharacterFormData,
  type RoleplayCharacter,
  type RoleplayTemplate,
} from '../../utils/roleplay';
import styles from './CharacterPanel.module.css';

function compressPortrait(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) {
          h = Math.round(h * maxPx / w);
          w = maxPx;
        } else {
          w = Math.round(w * maxPx / h);
          h = maxPx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas error')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('image load error'));
    img.src = dataUrl;
  });
}

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
  const { pushCharacter } = useSyncStore();
  const { status: authStatus } = useAuthStore();
  const isLoggedIn = authStatus === 'authenticated';

  const [tab, setTab] = useState<'characters' | 'templates'>('characters');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<
    | { kind: 'character'; data: CharacterFormData; template?: RoleplayTemplate | null }
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

  const openEditCharacter = (character: RoleplayCharacter) => {
    const template = getTemplateById(templates, character.templateId);
    setEditor({
      kind: 'character',
      template,
      data: {
        ...character,
        statusFieldEnabled: buildCharacterStatusEnabledMap(character, template),
      },
    });
  };

  const openNewTemplate = () => {
    setEditor({ kind: 'template', data: { ...emptyTemplateForm(), id: `tpl-${Date.now()}` } });
  };

  const openEditTemplate = (template: RoleplayTemplate) => {
    setEditor({ kind: 'template', data: templateFormFromTemplate(template) });
  };

  const openDuplicateTemplate = (template: RoleplayTemplate) => {
    setEditor({ kind: 'template', data: duplicateTemplateForm(template) });
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
            <span className={styles.hint}>请先在「模板」页用模板创建角色</span>
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
                    <button
                      type="button"
                      className={styles.actionBtn}
                      title={isLoggedIn ? '同步到云端' : '登录后可同步到云端'}
                      disabled={!isLoggedIn || syncingId === c.id}
                      onClick={async () => {
                        if (!isLoggedIn) { alert('请先登录'); return; }
                        setSyncingId(c.id);
                        try {
                          let portraitBase64: string | undefined;
                          let portraitFullBase64: string | undefined;
                          if (c.portraitPath) {
                            try {
                              const raw = await window.api.files.readBinary(c.portraitPath);
                              portraitBase64 = await compressPortrait(raw, 512);
                            } catch (e) { console.warn('读取头像失败', e); }
                          }
                          if (c.portraitFullPath) {
                            try {
                              const raw = await window.api.files.readBinary(c.portraitFullPath);
                              portraitFullBase64 = await compressPortrait(raw, 1024);
                            } catch (e) { console.warn('读取全身像失败', e); }
                          }
                          const payload = JSON.stringify({
                            name: c.name,
                            gender: c.gender,
                            occupation: c.occupation,
                            personality: c.personality,
                            background: c.background,
                            body: c.body,
                            openingStory: c.openingStory,
                            portraitBase64,
                            portraitFullBase64,
                            templateId: c.templateId,
                            statusFieldEnabled: c.statusFieldEnabled,
                          });
                          const res = await pushCharacter(c.id, c.name, payload);
                          if (res) {
                            alert('角色已同步到云端 ✓');
                          } else {
                            alert('同步失败');
                          }
                        } finally {
                          setSyncingId(null);
                        }
                      }}
                    >
                      {syncingId === c.id ? '⋯' : '☁'}
                    </button>
                    <button type="button" className={styles.actionBtnDanger} onClick={() => void deleteCharacter(c.id)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
            {characters.length === 0 && !loading && (
              <div className={styles.empty}>暂无角色，请切换到「模板」页创建</div>
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
                  <div className={styles.cardName}>{t.name}</div>
                  <div className={styles.cardMeta}>{t.personality || t.background || '通用模板'}</div>
                  <div className={styles.cardActions}>
                    <button type="button" className={styles.actionBtn} onClick={() => void createFromTemplate(t.id).then(c => c && openEditCharacter(c))}>
                      用模板创建
                    </button>
                    <button type="button" className={styles.actionBtn} onClick={() => openEditTemplate(t)}>编辑</button>
                    <button type="button" className={styles.actionBtn} onClick={() => openDuplicateTemplate(t)}>复制</button>
                    <button type="button" className={styles.actionBtnDanger} onClick={() => void deleteTemplate(t.id)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
            {templates.length === 0 && !loading && (
              <div className={styles.empty}>暂无模板，请先新建模板</div>
            )}
          </div>
        </>
      )}

      {editor?.kind === 'character' && (
        <CharacterEditor
          title="编辑角色"
          editorMode="character"
          template={editor.template}
          initial={editor.data}
          draftId={editor.data.id || `draft-${Date.now()}`}
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
          title={
            editor.data.id && templates.some(t => t.id === editor.data.id)
              ? '编辑模板'
              : '新建模板'
          }
          editorMode="template"
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
