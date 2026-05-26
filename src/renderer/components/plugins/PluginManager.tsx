import React, { useEffect } from 'react';
import { usePluginStore } from '../../stores/plugin';
import DiscoverTab from './DiscoverTab';
import InstalledTab from './InstalledTab';
import MarketplacesTab from './MarketplacesTab';
import ErrorsTab from './ErrorsTab';
import styles from './PluginManager.module.css';

interface Props {
  onClose: () => void;
}

const TABS = [
  { key: 'discover' as const, label: '🔍 Discover' },
  { key: 'installed' as const, label: '📦 Installed' },
  { key: 'marketplaces' as const, label: '🏪 Marketplaces' },
  { key: 'errors' as const, label: '⚠️ Errors' },
];

export default function PluginManager({ onClose }: Props) {
  const { activeTab, setActiveTab, loadMarketplaces, loadInstalled, loadErrors, errors } = usePluginStore();

  useEffect(() => {
    loadMarketplaces();
    loadInstalled();
    loadErrors();
  }, []);

  return (
    <div className={styles.overlay} data-focus-guard>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>插件管理器</span>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>

        <div className={styles.tabs}>
          {TABS.map(tab => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            >
              {tab.label}
              {tab.key === 'errors' && errors.length > 0 && (
                <span className={styles.tabBadge}>{errors.length}</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === 'discover' && <DiscoverTab />}
          {activeTab === 'installed' && <InstalledTab />}
          {activeTab === 'marketplaces' && <MarketplacesTab />}
          {activeTab === 'errors' && <ErrorsTab />}
        </div>
      </div>
    </div>
  );
}
