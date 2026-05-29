import React, { useState, useEffect, useMemo } from 'react';
import {
  useModelStore,
  ModelConfig,
  ImageModelConfig,
  VisionModelConfig,
  PROVIDERS,
  ProviderKey,
} from '../../stores/model';
import styles from './ModelSettings.module.css';

interface Props {
  onClose: () => void;
}

export default function ModelSettings({ onClose }: Props) {
  const { models, saveModels, getActiveModel, setActiveModel, imageModel, loadImageModel, saveImageModel, visionModel, loadVisionModel, saveVisionModel } = useModelStore();
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [list, setList] = useState<ModelConfig[]>(models);
  const [imageConfig, setImageConfig] = useState<ImageModelConfig>(imageModel);
  const [visionConfig, setVisionConfig] = useState<VisionModelConfig>(visionModel);

  useEffect(() => {
    loadImageModel();
    loadVisionModel();
  }, []);

  useEffect(() => { setImageConfig(imageModel); }, [imageModel]);
  useEffect(() => { setVisionConfig(visionModel); }, [visionModel]);
  useEffect(() => { setList(models); }, [models]);

  const active = getActiveModel();
  const activeProvider = PROVIDERS[active.provider];

  const grouped = useMemo(() => {
    const map = new Map<ProviderKey, ModelConfig[]>();
    for (const m of list) {
      const group = map.get(m.provider) || [];
      group.push(m);
      map.set(m.provider, group);
    }
    return map;
  }, [list]);

  const handleSave = async () => {
    const savedVision = activeProvider.multimodal ? visionConfig : { ...visionConfig, useActiveModel: false };
    await saveModels(list);
    await saveImageModel(imageConfig);
    await saveVisionModel(savedVision);
    onClose();
  };

  const addModel = () => {
    const id = `custom-${Date.now()}`;
    setEditing({
      id,
      name: '新模型',
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o',
      contextWindow: 128000,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const idx = list.findIndex(m => m.id === editing.id);
    if (idx >= 0) {
      setList(l => l.map((m, i) => i === idx ? editing : m));
    } else {
      setList(l => [...l, editing]);
    }
    setEditing(null);
  };

  const removeModel = (id: string) => {
    setList(l => l.filter(m => m.id !== id));
  };

  return (
    <div className={styles.overlay} data-focus-guard>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>模型设置</span>
          <button onClick={onClose} className={styles.closeBtn}>
            <img src="/assets/图层 12_w.png" alt="close" className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.modelList}>
          {[...grouped.entries()].map(([provider, groupModels]) => (
            <div key={provider} className={styles.providerGroup}>
              <div className={styles.providerHeader}>
                <span className={styles.providerLabel}>{PROVIDERS[provider].label}</span>
                {PROVIDERS[provider].multimodal && (
                  <span className={styles.multimodalBadge}>多模态</span>
                )}
              </div>
              {groupModels.map(m => (
                <div
                  key={m.id}
                  className={`${styles.modelRow} ${m.id === active.id ? styles.modelRowActive : styles.modelRowInactive}`}
                >
                  <input
                    type="radio"
                    checked={m.id === active.id}
                    onChange={() => setActiveModel(m.id)}
                    className={styles.radio}
                  />
                  <div className={styles.modelInfo}>
                    <div className={styles.modelName}>
                      {m.name} {m.apiKey ? '🔑' : ''}
                    </div>
                    <div className={styles.modelMeta}>
                      {m.model} {m.apiKey ? '（独立Key）' : ''}
                    </div>
                  </div>
                  <button onClick={() => setEditing({ ...m })} className={styles.actionBtn}>编辑</button>
                  <button onClick={() => removeModel(m.id)} className={styles.deleteBtn}>删除</button>
                </div>
              ))}
            </div>
          ))}

          <button onClick={addModel} className={styles.addBtn}>
            + 添加模型
          </button>
        </div>

        <div className={styles.panelExtras}>
        <ModelSection
          title="生图模型配置"
          enabled={imageConfig.enabled}
          onEnableChange={v => setImageConfig(c => ({ ...c, enabled: v }))}
          baseUrl={imageConfig.baseUrl}
          onBaseUrlChange={v => setImageConfig(c => ({ ...c, baseUrl: v }))}
          model={imageConfig.model}
          onModelChange={v => setImageConfig(c => ({ ...c, model: v }))}
          apiKey={imageConfig.apiKey}
          onApiKeyChange={v => setImageConfig(c => ({ ...c, apiKey: v }))}
          checkboxLabel="启用生图功能"
        >
          {activeProvider.multimodal && (
            <div className={styles.hintText}>
              当前对话模型（{activeProvider.label}）已支持多模态，可直接在对话中生成图片。
            </div>
          )}
        </ModelSection>

        <ModelSection
          title="视觉模型配置"
          enabled={visionConfig.enabled}
          onEnableChange={v => setVisionConfig(c => ({ ...c, enabled: v }))}
          baseUrl={visionConfig.baseUrl}
          onBaseUrlChange={v => setVisionConfig(c => ({ ...c, baseUrl: v }))}
          model={visionConfig.model}
          onModelChange={v => setVisionConfig(c => ({ ...c, model: v }))}
          apiKey={visionConfig.apiKey}
          onApiKeyChange={v => setVisionConfig(c => ({ ...c, apiKey: v }))}
          checkboxLabel="启用视觉功能（describe_image 工具）"
        >
          {activeProvider.multimodal && (
            <div className={styles.checkboxRow}>
              <input
                type="checkbox"
                id="vision-use-active"
                checked={visionConfig.useActiveModel}
                onChange={e => setVisionConfig(c => ({ ...c, useActiveModel: e.target.checked }))}
              />
              <label htmlFor="vision-use-active" className={styles.checkboxLabel}>
                使用当前对话模型（{active.name}）进行视觉识别
              </label>
            </div>
          )}
          {!visionConfig.useActiveModel && visionConfig.enabled && (
            <div className={styles.hintText}>
              使用独立视觉模型。若当前对话模型支持多模态，可勾选上方选项避免额外配置。
            </div>
          )}
        </ModelSection>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>取消</button>
          <button onClick={handleSave} className={styles.saveBtn}>保存</button>
        </div>
      </div>

      {editing && (
        <ModelEditDialog
          editing={editing}
          list={list}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

function ModelEditDialog({
  editing,
  list,
  onChange,
  onCancel,
  onSave,
}: {
  editing: ModelConfig;
  list: ModelConfig[];
  onChange: (model: ModelConfig) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const handleProviderChange = (provider: ProviderKey) => {
    const preset = PROVIDERS[provider];
    onChange({
      ...editing,
      provider,
      baseUrl: preset.baseUrl,
      model: preset.defaultModel,
      contextWindow: preset.contextWindow,
    });
  };

  return (
    <div className={styles.overlay} style={{ zIndex: 1001 }}>
      <div className={styles.editPanel}>
        <div className={styles.editTitle}>
          {editing.id.startsWith('custom-') && !list.find(m => m.id === editing.id) ? '添加模型' : '编辑模型'}
        </div>
        <FieldRow label="显示名称">
          <input
            value={editing.name}
            onChange={e => onChange({ ...editing, name: e.target.value })}
            className={styles.input}
          />
        </FieldRow>
        <FieldRow label="提供商">
          <select
            value={editing.provider}
            onChange={e => handleProviderChange(e.target.value as ProviderKey)}
            className={styles.select}
          >
            {(Object.keys(PROVIDERS) as ProviderKey[]).map(k => (
              <option key={k} value={k}>
                {PROVIDERS[k].label}
                {PROVIDERS[k].multimodal ? ' (多模态)' : ''}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Base URL">
          <input
            value={editing.baseUrl}
            onChange={e => onChange({ ...editing, baseUrl: e.target.value })}
            className={styles.input}
            placeholder="https://api.openai.com"
          />
        </FieldRow>
        <FieldRow label="模型 ID">
          <input
            value={editing.model}
            onChange={e => onChange({ ...editing, model: e.target.value })}
            className={styles.input}
            placeholder="gpt-4o"
          />
        </FieldRow>
        <FieldRow label="上下文窗口">
          <div className={styles.rowSplit}>
            <input
              type="number"
              value={editing.contextWindow ?? 64000}
              onChange={e => onChange({ ...editing, contextWindow: parseInt(e.target.value) || 0 })}
              className={styles.input}
            />
            <select
              value={editing.contextWindow ?? 64000}
              onChange={e => onChange({ ...editing, contextWindow: parseInt(e.target.value) })}
              className={styles.select}
            >
              <option value={8000}>8k</option>
              <option value={10000}>10k</option>
              <option value={16000}>16k</option>
              <option value={32000}>32k</option>
              <option value={64000}>64k</option>
              <option value={128000}>128k</option>
              <option value={1000000}>1M</option>
              <option value={2000000}>2M</option>
            </select>
          </div>
        </FieldRow>
        <FieldRow label="API Key（可选，覆盖全局 Key）">
          <input
            type="password"
            value={editing.apiKey || ''}
            onChange={e => onChange({ ...editing, apiKey: e.target.value || undefined })}
            className={styles.input}
            placeholder="留空则使用全局 API Key"
          />
        </FieldRow>
        <div className={styles.editFooter}>
          <button onClick={onCancel} className={styles.cancelBtn}>取消</button>
          <button onClick={onSave} className={styles.saveBtn}>确定</button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function ModelSection({
  title, enabled, onEnableChange,
  baseUrl, onBaseUrlChange,
  model, onModelChange,
  apiKey, onApiKeyChange,
  checkboxLabel,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnableChange: (v: boolean) => void;
  baseUrl: string;
  onBaseUrlChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  checkboxLabel: string;
  children?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(!enabled);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader} onClick={() => setCollapsed(!collapsed)}>
        <span className={styles.chevron}>{collapsed ? '▶' : '▼'}</span>
        <span className={styles.sectionTitle}>{title}</span>
        {enabled && <span className={styles.enabledBadge}>已启用</span>}
      </div>
      {!collapsed && (
        <div className={styles.sectionBody}>
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id={`section-${title}`}
              checked={enabled}
              onChange={e => onEnableChange(e.target.checked)}
            />
            <label htmlFor={`section-${title}`} className={styles.checkboxLabel}>{checkboxLabel}</label>
          </div>
          {children}
          {enabled && (
            <>
              <FieldRow label="Base URL">
                <input value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)} className={styles.input} placeholder="https://api.openai.com" />
              </FieldRow>
              <FieldRow label="模型 ID">
                <input value={model} onChange={e => onModelChange(e.target.value)} className={styles.input} placeholder="gpt-4o" />
              </FieldRow>
              <FieldRow label="API Key">
                <input type="password" value={apiKey} onChange={e => onApiKeyChange(e.target.value)} className={styles.input} placeholder="sk-..." />
              </FieldRow>
            </>
          )}
        </div>
      )}
    </div>
  );
}
