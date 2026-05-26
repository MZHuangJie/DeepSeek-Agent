import React, { useEffect, useState } from 'react';
import styles from './CharacterEditor.module.css';
import {
  BODY_FIELDS,
  DEFAULT_STATUS_FIELDS,
  cloneStatusFields,
  createCustomStatusField,
  normalizeStatusFields,
  getTemplateStatusFieldDefs,
  type CharacterFormData,
  type BodyMeasurements,
  type StatusFieldDef,
  type StatusFieldSection,
  type StatusFieldType,
  type RoleplayTemplate,
  type PortraitGenerateStage,
  PORTRAIT_GEN_STAGE_LABELS,
  PORTRAIT_STYLE_GROUPS,
  DEFAULT_PORTRAIT_STYLE,
  getPortraitStylesByGroup,
  type PortraitStyleId,
} from '../../utils/roleplay';
import { useRoleplayStore } from '../../stores/roleplay';

interface Props {
  title: string;
  editorMode: 'template' | 'character';
  initial: CharacterFormData;
  draftId: string;
  /** 角色模式：关联模板的状态字段定义（只读 schema） */
  template?: RoleplayTemplate | null;
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

const SECTION_LABELS: Record<StatusFieldSection, string> = {
  clothing: '服装',
  state: '状态',
  monologue: '独白',
};

const TYPE_LABELS: Record<StatusFieldType, string> = {
  text: '文本',
  number: '数字',
  list: '列表',
};

export default function CharacterEditor({
  title,
  editorMode,
  initial,
  draftId,
  template,
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
  const [portraitStyle, setPortraitStyle] = useState<PortraitStyleId>(DEFAULT_PORTRAIT_STYLE);
  const [showBody, setShowBody] = useState(() => Boolean(formatBodyHasValue(initial.body)));
  const [showStatusFields, setShowStatusFields] = useState(false);

  const isTemplateMode = editorMode === 'template';
  const templateFieldDefs = getTemplateStatusFieldDefs(template);
  const statusFields = isTemplateMode
    ? (form.statusFields?.length ? form.statusFields : cloneStatusFields())
    : templateFieldDefs;

  const updateStatusFields = (next: StatusFieldDef[]) => {
    setForm(f => ({ ...f, statusFields: next }));
  };

  const updateStatusFieldEnabled = (key: string, enabled: boolean) => {
    setForm(f => ({
      ...f,
      statusFieldEnabled: { ...(f.statusFieldEnabled || {}), [key]: enabled },
    }));
  };

  const isStatusFieldEnabled = (field: StatusFieldDef) =>
    form.statusFieldEnabled?.[field.key] !== false;

  const handleAddStatusField = () => {
    updateStatusFields([...statusFields, createCustomStatusField()]);
  };

  const handleRemoveStatusField = (idx: number) => {
    updateStatusFields(statusFields.filter((_, i) => i !== idx));
  };

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
      if (isTemplateMode) {
        await onSave({
          ...form,
          statusFields: normalizeStatusFields(
            form.statusFields?.length ? form.statusFields : cloneStatusFields(),
          ),
        });
      } else {
        await onSave({
          ...form,
          statusFieldEnabled: Object.fromEntries(
            templateFieldDefs.map(f => [f.key, form.statusFieldEnabled?.[f.key] !== false]),
          ),
          statusFields: undefined,
        });
      }
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
      const result = await onGeneratePortrait(
        form.id || draftId,
        { ...form, portraitStyle },
        stage => {
          setPortraitGenStage(stage);
        },
      );
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
              <label className={styles.portraitStyleField}>
                <span>生图风格</span>
                <select
                  className={styles.portraitStyleSelect}
                  value={portraitStyle}
                  disabled={generatingPortrait}
                  onChange={e => setPortraitStyle(e.target.value as PortraitStyleId)}
                >
                  {PORTRAIT_STYLE_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {getPortraitStylesByGroup(group).map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
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
            <span>{isTemplateMode ? '模板名称 *' : '姓名 *'}</span>
            <input
              value={form.name}
              disabled={readOnlyName}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={isTemplateMode ? '模板名称' : '角色姓名'}
            />
          </label>

          {!isTemplateMode && template && (
            <div className={styles.templateRef}>
              关联模板：<strong>{template.name}</strong>
            </div>
          )}

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

          <button type="button" className={styles.toggleBodyBtn} onClick={() => setShowStatusFields(v => !v)}>
            {showStatusFields
              ? (isTemplateMode ? '收起状态面板配置' : '收起状态字段启用')
              : (isTemplateMode
                ? '展开状态面板配置（每轮回复下方展示）'
                : '展开状态字段启用（字段定义来自模板）')}
          </button>

          {showStatusFields && isTemplateMode && (
            <div className={styles.statusFieldsBlock}>
              <div className={styles.statusFieldsHint}>
                在模板中配置状态字段 schema；角色创建后只能启用/禁用，不能修改字段定义。
              </div>
              <div className={styles.statusFieldHeader}>
                <span>默认启用</span>
                <span>状态名称</span>
                <span>类型</span>
                <span>分区</span>
                <span>模型说明</span>
                <span />
              </div>
              {statusFields.map((field, idx) => (
                <div key={`${field.key}-${idx}`} className={styles.statusFieldRow}>
                  <label className={styles.statusFieldCheck}>
                    <input
                      type="checkbox"
                      checked={field.enabled !== false}
                      onChange={e => {
                        const next = cloneStatusFields(statusFields);
                        next[idx] = { ...next[idx], enabled: e.target.checked };
                        updateStatusFields(next);
                      }}
                    />
                  </label>
                  <input
                    className={styles.statusFieldName}
                    value={field.label}
                    onChange={e => {
                      const next = cloneStatusFields(statusFields);
                      next[idx] = { ...next[idx], label: e.target.value };
                      updateStatusFields(next);
                    }}
                    placeholder="如：好感度"
                  />
                  <select
                    className={styles.statusFieldSelect}
                    value={field.type}
                    onChange={e => {
                      const next = cloneStatusFields(statusFields);
                      next[idx] = { ...next[idx], type: e.target.value as StatusFieldType };
                      updateStatusFields(next);
                    }}
                  >
                    <option value="text">文本</option>
                    <option value="number">数字</option>
                    <option value="list">列表</option>
                  </select>
                  <select
                    className={styles.statusFieldSelect}
                    value={field.section}
                    onChange={e => {
                      const next = cloneStatusFields(statusFields);
                      next[idx] = { ...next[idx], section: e.target.value as StatusFieldSection };
                      updateStatusFields(next);
                    }}
                  >
                    <option value="state">状态（标签）</option>
                    <option value="clothing">服装（列表）</option>
                    <option value="monologue">独白（段落）</option>
                  </select>
                  <input
                    className={styles.statusFieldHint}
                    value={field.promptHint || ''}
                    onChange={e => {
                      const next = cloneStatusFields(statusFields);
                      next[idx] = { ...next[idx], promptHint: e.target.value || undefined };
                      updateStatusFields(next);
                    }}
                    placeholder="给模型的字段说明（可选）"
                  />
                  <button
                    type="button"
                    className={styles.statusFieldRemove}
                    title="删除"
                    onClick={() => handleRemoveStatusField(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className={styles.statusFieldActions}>
                <button type="button" className={styles.secondaryBtn} onClick={handleAddStatusField}>
                  + 添加状态
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => updateStatusFields(cloneStatusFields(DEFAULT_STATUS_FIELDS))}
                >
                  恢复默认字段
                </button>
              </div>
            </div>
          )}

          {showStatusFields && !isTemplateMode && (
            <div className={styles.statusFieldsBlock}>
              <div className={styles.statusFieldsHint}>
                以下字段由模板「{template?.name || '未知'}」定义，此处仅控制本角色是否启用。
              </div>
              <div className={styles.statusFieldHeader}>
                <span>启用</span>
                <span>状态名称</span>
                <span>类型</span>
                <span>分区</span>
                <span>模型说明</span>
              </div>
              {statusFields.map(field => (
                <div key={field.key} className={styles.statusFieldRow}>
                  <label className={styles.statusFieldCheck}>
                    <input
                      type="checkbox"
                      checked={isStatusFieldEnabled(field)}
                      onChange={e => updateStatusFieldEnabled(field.key, e.target.checked)}
                    />
                  </label>
                  <span className={styles.statusFieldReadonly}>{field.label}</span>
                  <span className={styles.statusFieldReadonly}>{TYPE_LABELS[field.type]}</span>
                  <span className={styles.statusFieldReadonly}>{SECTION_LABELS[field.section]}</span>
                  <span className={styles.statusFieldReadonlyHint}>{field.promptHint || '—'}</span>
                </div>
              ))}
              {statusFields.length === 0 && (
                <div className={styles.statusFieldsHint}>模板未配置状态字段</div>
              )}
            </div>
          )}
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
