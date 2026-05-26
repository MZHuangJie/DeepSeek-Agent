import React, { useEffect, useState } from 'react';
import styles from './CharacterEditor.module.css';
import {
  BODY_FIELDS,
  type CharacterFormData,
  type BodyMeasurements,
  type PortraitGenerateStage,
  PORTRAIT_GEN_STAGE_LABELS,
} from '../../utils/roleplay';
import { useRoleplayStore } from '../../stores/roleplay';

interface Props {
  title: string;
  initial: CharacterFormData;
  draftId: string;
  onSave: (data: CharacterFormData) => Promise<void>;
  onCancel: () => void;
  onPickPortrait: (ownerId: string) => Promise<string | null>;
  onGeneratePortrait?: (
    ownerId: string,
    data: CharacterFormData,
    onProgress?: (stage: PortraitGenerateStage) => void,
  ) => Promise<{ portraitPath: string; dataUrl?: string } | null>;
  readOnlyName?: boolean;
}

export default function CharacterEditor({
  title,
  initial,
  draftId,
  onSave,
  onCancel,
  onPickPortrait,
  onGeneratePortrait,
  readOnlyName,
}: Props) {
  const [form, setForm] = useState<CharacterFormData>(initial);
  const [portraitDataUrl, setPortraitDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [portraitGenStage, setPortraitGenStage] = useState<PortraitGenerateStage | null>(null);
  const [portraitGenError, setPortraitGenError] = useState('');
  const [showBody, setShowBody] = useState(() => Boolean(formatBodyHasValue(initial.body)));

  useEffect(() => {
    setForm(initial);
    setShowBody(Boolean(formatBodyHasValue(initial.body)));
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    if (!form.portraitPath) {
      setPortraitDataUrl(null);
      return;
    }
    void window.api.files.readBinary(form.portraitPath).then(url => {
      if (!cancelled) setPortraitDataUrl(url);
    }).catch((err: unknown) => {
      if (!cancelled) {
        setPortraitDataUrl(null);
        setPortraitGenError(err instanceof Error ? err.message : '立绘预览加载失败');
      }
    });
    return () => { cancelled = true; };
  }, [form.portraitPath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const updateBody = (key: keyof BodyMeasurements, value: string) => {
    setForm(f => ({
      ...f,
      body: { ...(f.body || {}), [key]: value || undefined },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handlePickPortrait = async () => {
    const path = await onPickPortrait(form.id || draftId);
    if (path) setForm(f => ({ ...f, portraitPath: path }));
  };

  const handleGeneratePortrait = async () => {
    if (!onGeneratePortrait || !form.name.trim()) return;
    setPortraitGenError('');
    setPortraitGenStage('prompt');
    setGeneratingPortrait(true);
    try {
      const result = await onGeneratePortrait(form.id || draftId, form, stage => {
        setPortraitGenStage(stage);
      });
      if (result?.portraitPath) {
        setForm(f => ({ ...f, portraitPath: result.portraitPath }));
        if (result.dataUrl) setPortraitDataUrl(result.dataUrl);
      } else {
        const msg = useRoleplayStore.getState().error;
        if (msg) setPortraitGenError(msg);
      }
    } catch (err: unknown) {
      setPortraitGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingPortrait(false);
      setPortraitGenStage(null);
    }
  };

  const generatingLabel = portraitGenStage === 'image'
    ? '生图阶段…'
    : portraitGenStage === 'prompt'
      ? '生成提示词…'
      : 'AI 生成中…';

  return (
    <div className={styles.overlay} data-focus-guard>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span>{title}</span>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>×</button>
        </div>

        <div className={styles.body}>
          <div className={styles.portraitBlock}>
            <div className={styles.portraitPreview}>
              {portraitDataUrl ? (
                <img src={portraitDataUrl} alt="立绘" className={styles.portraitImg} />
              ) : (
                <span className={styles.portraitPlaceholder}>暂无立绘</span>
              )}
            </div>
            <div className={styles.portraitActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => void handlePickPortrait()} disabled={generatingPortrait}>
                选择立绘
              </button>
              {onGeneratePortrait && (
                <button
                  type="button"
                  className={styles.aiBtn}
                  disabled={generatingPortrait || saving || !form.name.trim()}
                  onClick={() => void handleGeneratePortrait()}
                >
                  {generatingPortrait ? generatingLabel : 'AI 生成立绘'}
                </button>
              )}
              {generatingPortrait && portraitGenStage && (
                <span className={styles.genHint}>{PORTRAIT_GEN_STAGE_LABELS[portraitGenStage]}</span>
              )}
              {portraitGenError && <span className={styles.genError}>{portraitGenError}</span>}
            </div>
          </div>

          <label className={styles.field}>
            <span>姓名 *</span>
            <input
              value={form.name}
              disabled={readOnlyName}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="角色姓名"
            />
          </label>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span>性别</span>
              <input value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} placeholder="女 / 男 / 其他" />
            </label>
            <label className={styles.field}>
              <span>职业</span>
              <input value={form.occupation || ''} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} placeholder="职业" />
            </label>
          </div>

          <label className={styles.field}>
            <span>性格</span>
            <textarea value={form.personality || ''} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))} placeholder="性格特点" rows={2} />
          </label>

          <label className={styles.field}>
            <span>故事背景</span>
            <textarea value={form.background || ''} onChange={e => setForm(f => ({ ...f, background: e.target.value }))} placeholder="角色背景与世界观" rows={3} />
          </label>

          <button type="button" className={styles.toggleBodyBtn} onClick={() => setShowBody(v => !v)}>
            {showBody ? '收起身材细节' : '展开身材细节（可选）'}
          </button>

          {showBody && (
            <div className={styles.bodyGrid}>
              {BODY_FIELDS.map(({ key, label }) => (
                <label key={key} className={styles.field}>
                  <span>{label}</span>
                  <input
                    value={form.body?.[key] || ''}
                    onChange={e => updateBody(key, e.target.value)}
                    placeholder="可选"
                  />
                </label>
              ))}
            </div>
          )}

          <label className={styles.field}>
            <span>开场故事</span>
            <textarea
              value={form.openingStory || ''}
              onChange={e => setForm(f => ({ ...f, openingStory: e.target.value }))}
              placeholder="留空则模型根据故事背景自动生成开场"
              rows={3}
            />
          </label>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>取消</button>
          <button type="button" className={styles.primaryBtn} disabled={saving || !form.name.trim()} onClick={() => void handleSave()}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBodyHasValue(body?: BodyMeasurements): boolean {
  if (!body) return false;
  return BODY_FIELDS.some(({ key }) => Boolean(body[key]?.trim()));
}
