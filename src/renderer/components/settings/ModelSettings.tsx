import React, { useState, useEffect } from 'react';
import { useModelStore, ModelConfig, ImageModelConfig, VisionModelConfig } from '../../stores/model';

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

  useEffect(() => {
    setImageConfig(imageModel);
  }, [imageModel]);

  useEffect(() => {
    setList(models);
  }, [models]);

  const active = getActiveModel();

  const handleSave = async () => {
    await saveModels(list);
    await saveImageModel(imageConfig);
    await saveVisionModel(visionConfig);
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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
        width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>模型设置</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <img src="/assets/图层 12_w.png" alt="close" style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {list.map(m => (
            <div key={m.id} style={{
              padding: '8px 10px', borderRadius: 6, marginBottom: 6,
              background: m.id === active.id ? 'rgba(124,58,237,0.1)' : 'var(--bg-tertiary)',
              border: m.id === active.id ? '1px solid var(--accent)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <input
                type="radio"
                checked={m.id === active.id}
                onChange={() => setActiveModel(m.id)}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {m.provider} / {m.model}
                </div>
              </div>
              <button onClick={() => setEditing({ ...m })} style={{
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 12, padding: '2px 6px',
              }}>编辑</button>
              <button onClick={() => removeModel(m.id)} style={{
                background: 'transparent', border: 'none', color: '#ef4444',
                cursor: 'pointer', fontSize: 12, padding: '2px 6px',
              }}>删除</button>
            </div>
          ))}

          <button onClick={addModel} style={{
            width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px dashed var(--border)',
            color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>
            + 添加模型
          </button>
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>生图模型配置</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input
              type="checkbox"
              id="img-enabled"
              checked={imageConfig.enabled}
              onChange={e => setImageConfig(c => ({ ...c, enabled: e.target.checked }))}
            />
            <label htmlFor="img-enabled" style={{ fontSize: 12, cursor: 'pointer' }}>启用生图功能</label>
          </div>
          {imageConfig.enabled && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Base URL</div>
                <input
                  value={imageConfig.baseUrl}
                  onChange={e => setImageConfig(c => ({ ...c, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com"
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>模型 ID</div>
                <input
                  value={imageConfig.model}
                  onChange={e => setImageConfig(c => ({ ...c, model: e.target.value }))}
                  placeholder="gpt-image-1"
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>API Key</div>
                <input
                  type="password"
                  value={imageConfig.apiKey}
                  onChange={e => setImageConfig(c => ({ ...c, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* 视觉模型配置 */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>视觉模型配置</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input
              type="checkbox"
              id="vision-enabled"
              checked={visionConfig.enabled}
              onChange={e => setVisionConfig(c => ({ ...c, enabled: e.target.checked }))}
            />
            <label htmlFor="vision-enabled" style={{ fontSize: 12, cursor: 'pointer' }}>启用视觉功能（describe_image 工具）</label>
          </div>
          {visionConfig.enabled && (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Base URL</div>
                <input
                  value={visionConfig.baseUrl}
                  onChange={e => setVisionConfig(c => ({ ...c, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com"
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>模型 ID</div>
                <input
                  value={visionConfig.model}
                  onChange={e => setVisionConfig(c => ({ ...c, model: e.target.value }))}
                  placeholder="gpt-4o"
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>API Key</div>
                <input
                  type="password"
                  value={visionConfig.apiKey}
                  onChange={e => setVisionConfig(c => ({ ...c, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          }}>取消</button>
          <button onClick={handleSave} style={{
            padding: '6px 14px', background: 'var(--accent)', border: 'none',
            color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13,
          }}>保存</button>
        </div>
      </div>

      {editing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001,
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
            width: 400, padding: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editing.id.startsWith('custom-') && !list.find(m => m.id === editing.id) ? '添加模型' : '编辑模型'}</div>
            {([
              { key: 'name', label: '显示名称' },
              { key: 'provider', label: '提供商' },
              { key: 'baseUrl', label: 'Base URL' },
              { key: 'model', label: '模型 ID' },
            ] as { key: keyof ModelConfig; label: string }[]).map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                <input
                  value={editing[key] as string}
                  onChange={e => setEditing({ ...editing, [key]: e.target.value })}
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>上下文窗口</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  value={editing.contextWindow ?? 64000}
                  onChange={e => setEditing({ ...editing, contextWindow: parseInt(e.target.value) || 0 })}
                  style={{
                    flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                />
                <select
                  value={editing.contextWindow ?? 64000}
                  onChange={e => setEditing({ ...editing, contextWindow: parseInt(e.target.value) })}
                  style={{
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none',
                  }}
                >
                  <option value={8000}>8k</option>
                  <option value={32000}>32k</option>
                  <option value={64000}>64k</option>
                  <option value={128000}>128k</option>
                  <option value={1000000}>1M</option>
                  <option value={2000000}>2M</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setEditing(null)} style={{
                padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              }}>取消</button>
              <button onClick={saveEdit} style={{
                padding: '6px 14px', background: 'var(--accent)', border: 'none',
                color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              }}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
