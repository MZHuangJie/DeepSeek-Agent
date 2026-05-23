import React, { useState } from 'react';
import { useThemeStore, ThemePreset, ThemeArea, ThemeColors } from '../../stores/theme';

const PRESETS: ThemePreset[] = ['dark', 'light', 'dark-hc', 'light-warm', 'custom'];
const PRESET_LABELS: Record<ThemePreset, string> = { dark: '深色', light: '浅色', 'dark-hc': '深色高对比', 'light-warm': '暖色', custom: '自定义' };
const AREAS: Array<{ id: ThemeArea; label: string }> = [
  { id: 'global', label: '全局' },
  { id: 'editor', label: '编辑器' },
  { id: 'terminal', label: '终端' },
  { id: 'sidebar', label: '侧边栏' },
  { id: 'chat', label: '聊天区' },
  { id: 'agentPanel', label: 'Agent面板' },
];

const COLOR_KEYS: Array<{ key: keyof ThemeColors; label: string }> = [
  { key: 'bgPrimary', label: '主背景' },
  { key: 'bgSecondary', label: '次背景' },
  { key: 'bgTertiary', label: '三级背景' },
  { key: 'textPrimary', label: '主文字' },
  { key: 'textSecondary', label: '次文字' },
  { key: 'accent', label: '强调色' },
  { key: 'border', label: '边框' },
  { key: 'chatUser', label: '用户气泡' },
  { key: 'chatAi', label: 'AI气泡' },
];

export default function ThemeSettings({ onClose }: { onClose: () => void }) {
  const store = useThemeStore();
  const [selectedArea, setSelectedArea] = useState<ThemeArea>('global');
  const [customColors, setCustomColors] = useState<ThemeColors>(store.globalCustom);

  const areaPreset = selectedArea === 'global'
    ? store.globalPreset
    : (store.areas[selectedArea]?.preset ?? 'dark');
  const areaColors = store.getAreaColors(selectedArea);

  const handlePresetChange = (p: ThemePreset) => {
    if (selectedArea === 'global') {
      store.setGlobalPreset(p);
      if (p === 'custom') store.setGlobalCustom(customColors);
    } else {
      store.setAreaPreset(selectedArea, p);
      if (p === 'custom') store.setAreaCustom(selectedArea, customColors);
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const updated = { ...customColors, [key]: value };
    setCustomColors(updated);
    if (selectedArea === 'global') {
      if (store.globalPreset === 'custom') store.setGlobalCustom(updated);
    } else {
      if ((store.areas[selectedArea]?.preset ?? 'dark') === 'custom') store.setAreaCustom(selectedArea, updated);
    }
  };

  const startCustom = () => {
    setCustomColors(areaColors);
    handlePresetChange('custom');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>主题配置</span>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, opacity: 0.6 }}>✕</span>
        </div>

        {/* Area tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflow: 'auto' }}>
          {AREAS.map(a => (
            <div key={a.id} onClick={() => setSelectedArea(a.id)}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
                color: selectedArea === a.id ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: selectedArea === a.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >{a.label}</div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
          {/* Preset selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>预设主题</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map(p => (
                <button key={p} onClick={() => p === 'custom' ? startCustom() : handlePresetChange(p)}
                  style={{
                    padding: '5px 12px', borderRadius: 4, border: areaPreset === p ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: areaPreset === p ? 'var(--accent)' : 'transparent',
                    color: areaPreset === p ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: 12,
                  }}
                >{PRESET_LABELS[p]}</button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 6, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}
            ref={el => {
              if (el) {
                el.style.background = areaColors.bgPrimary;
                el.style.color = areaColors.textPrimary;
              }
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600 }}>预览</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>这是文字颜色示例</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ background: areaColors.bgSecondary, padding: '2px 8px', borderRadius: 3, fontSize: 10 }}>次背景</span>
              <span style={{ background: areaColors.bgTertiary, padding: '2px 8px', borderRadius: 3, fontSize: 10 }}>三级</span>
              <span style={{ background: areaColors.accent, padding: '2px 8px', borderRadius: 3, fontSize: 10, color: '#fff' }}>强调色</span>
            </div>
          </div>

          {/* Color pickers (only in custom mode) */}
          {areaPreset === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {COLOR_KEYS.map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={customColors[key].startsWith('#') ? customColors[key] : '#7c3aed'}
                    onChange={e => handleColorChange(key, e.target.value)}
                    style={{ width: 28, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {selectedArea !== 'global' && (
            <button onClick={() => store.resetArea(selectedArea)} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
              重置区域
            </button>
          )}
          <button onClick={onClose} style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
