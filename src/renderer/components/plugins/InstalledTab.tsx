import React from 'react';
import { usePluginStore } from '../../stores/plugin';

export default function InstalledTab() {
  const { installedPlugins, uninstallPlugin } = usePluginStore();

  return (
    <div>
      {installedPlugins.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>尚未安装插件</div>
          <div style={{ fontSize: 12 }}>在 <b>Discover</b> 标签页浏览并安装插件</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {installedPlugins.map(p => (
          <div key={p.name} style={{
            padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 6,
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>/{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {p.description || '无描述'}
              </div>
              {p.source && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2 }}>
                  来源: {p.source}
                </div>
              )}
            </div>
            <button
              onClick={() => uninstallPlugin(p.name)}
              style={{
                padding: '4px 12px', background: 'transparent', border: '1px solid #ef4444',
                color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11, flexShrink: 0,
              }}
            >
              卸载
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
