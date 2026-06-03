import React, { useState } from 'react';
import { useThemeStore, ThemePreset, ThemeArea, ThemeColors } from '../../stores/theme';
import { useIconThemeStore } from '../../stores/iconTheme';
import styles from './ThemeSettings.module.css';

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

function IconThemePicker() {
  const availableThemes = useIconThemeStore(s => s.availableThemes);
  const currentThemeId = useIconThemeStore(s => s.currentThemeId);
  const busy = useIconThemeStore(s => s.busy);
  const setTheme = useIconThemeStore(s => s.setTheme);

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>文件图标主题</div>
      <div className={styles.presetRow}>
        {availableThemes.map(t => (
          <button
            key={t.id}
            onClick={() => { void setTheme(t.id); }}
            className={`${styles.presetBtn} ${currentThemeId === t.id ? styles.presetBtnActive : ''}`}
            disabled={busy}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div className={styles.overlay} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>主题配置</span>
          <span onClick={onClose} className={styles.closeX}>✕</span>
        </div>

        <div className={styles.tabs}>
          {AREAS.map(a => (
            <div key={a.id} onClick={() => setSelectedArea(a.id)}
              className={`${styles.tab} ${selectedArea === a.id ? styles.tabActive : styles.tabInactive}`}
            >{a.label}</div>
          ))}
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>预设主题</div>
            <div className={styles.presetRow}>
              {PRESETS.map(p => (
                <button key={p} onClick={() => p === 'custom' ? startCustom() : handlePresetChange(p)}
                  className={`${styles.presetBtn} ${areaPreset === p ? styles.presetBtnActive : ''}`}
                >{PRESET_LABELS[p]}</button>
              ))}
            </div>
          </div>

          <IconThemePicker />

          <div className={styles.preview}
            ref={el => {
              if (el) {
                el.style.background = areaColors.bgPrimary;
                el.style.color = areaColors.textPrimary;
              }
            }}
          >
            <div className={styles.previewTitle}>预览</div>
            <div className={styles.previewText}>这是文字颜色示例</div>
            <div className={styles.previewChips}>
              <span className={styles.previewChip} style={{ background: areaColors.bgSecondary }}>次背景</span>
              <span className={styles.previewChip} style={{ background: areaColors.bgTertiary }}>三级</span>
              <span className={styles.previewChip} style={{ background: areaColors.accent, color: '#fff' }}>强调色</span>
            </div>
          </div>

          {areaPreset === 'custom' && (
            <div className={styles.colorGrid}>
              {COLOR_KEYS.map(({ key, label }) => (
                <div key={key} className={styles.colorRow}>
                  <input type="color" value={customColors[key].startsWith('#') ? customColors[key] : '#7c3aed'}
                    onChange={e => handleColorChange(key, e.target.value)}
                    className={styles.colorInput}
                  />
                  <span className={styles.colorLabel}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {selectedArea !== 'global' && (
            <button onClick={() => store.resetArea(selectedArea)} className={styles.resetBtn}>
              重置区域
            </button>
          )}
          <button onClick={onClose} className={styles.doneBtn}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
