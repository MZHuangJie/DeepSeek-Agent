import React from 'react';
import { usePluginStore } from '../../stores/plugin';

export default function ErrorsTab() {
  const { errors, clearErrors, installPlugin, discoveredPlugins } = usePluginStore();

  const retryInstall = (name: string) => {
    const plugin = discoveredPlugins.find(p => p.name === name);
    if (plugin) installPlugin(plugin);
  };

  return (
    <div>
      {errors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 14 }}>✅ 没有错误</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={clearErrors}
              style={{
                padding: '4px 12px', background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 11,
              }}
            >
              清除全部
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {errors.map(e => (
              <div key={e.id} style={{
                padding: '10px 12px', background: 'rgba(239,68,68,0.08)',
                borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {e.plugin_name && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{e.plugin_name}</div>
                    )}
                    {e.marketplace && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>源: {e.marketplace}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-word' }}>
                      {e.error}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.5, marginTop: 4 }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {e.plugin_name && (
                    <button
                      onClick={() => retryInstall(e.plugin_name!)}
                      style={{
                        padding: '4px 10px', background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
                        borderRadius: 4, cursor: 'pointer', fontSize: 11, flexShrink: 0,
                      }}
                    >
                      重试
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
