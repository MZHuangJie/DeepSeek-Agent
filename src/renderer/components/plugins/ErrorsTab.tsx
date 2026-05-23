import React from 'react';
import { usePluginStore } from '../../stores/plugin';
import s from './PluginShared.module.css';

export default function ErrorsTab() {
  const { errors, clearErrors, installPlugin, discoveredPlugins } = usePluginStore();

  const retryInstall = (name: string) => {
    const plugin = discoveredPlugins.find(p => p.name === name);
    if (plugin) installPlugin(plugin);
  };

  return (
    <div>
      {errors.length === 0 ? (
        <div className={s.emptyHint}>
          <div className={s.emptyTitle}>✅ 没有错误</div>
        </div>
      ) : (
        <>
          <div className={s.errorActions}>
            <button onClick={clearErrors} className={s.clearBtn}>清除全部</button>
          </div>

          <div className={s.cardList}>
            {errors.map(e => (
              <div key={e.id} className={`${s.card} ${s.cardError}`}>
                <div className={s.errorHeader}>
                  <div className={s.errorBody}>
                    {e.plugin_name && (
                      <div className={s.errorName}>{e.plugin_name}</div>
                    )}
                    {e.marketplace && (
                      <div className={s.errorSource}>源: {e.marketplace}</div>
                    )}
                    <div className={s.errorMsg}>{e.error}</div>
                    <div className={s.errorTime}>
                      {new Date(e.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {e.plugin_name && (
                    <button onClick={() => retryInstall(e.plugin_name!)} className={s.retryBtn}>
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
