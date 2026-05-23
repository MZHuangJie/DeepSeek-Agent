import React from 'react';
import { usePluginStore } from '../../stores/plugin';
import s from './PluginShared.module.css';

export default function InstalledTab() {
  const { installedPlugins, uninstallPlugin } = usePluginStore();

  return (
    <div>
      {installedPlugins.length === 0 && (
        <div className={s.emptyHint}>
          <div className={s.emptyTitle}>尚未安装插件</div>
          <div className={s.emptyDesc}>在 <b>Discover</b> 标签页浏览并安装插件</div>
        </div>
      )}

      <div className={s.cardList}>
        {installedPlugins.map(p => (
          <div key={p.name} className={s.card}>
            <div className={s.cardBody}>
              <div className={s.cardTitle}>/{p.name}</div>
              <div className={s.cardDesc}>{p.description || '无描述'}</div>
              {p.source && (
                <div className={s.cardMeta}>来源: {p.source}</div>
              )}
            </div>
            <button onClick={() => uninstallPlugin(p.name)} className={s.removeBtn}>
              卸载
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
