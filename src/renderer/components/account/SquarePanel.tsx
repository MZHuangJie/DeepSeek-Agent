import React, { useEffect, useState } from 'react';
import { useSquareStore, type SquareCharacter, type SquareModel } from '../../stores/square';
import { useRoleplayStore } from '../../stores/roleplay';
import { useModelStore } from '../../stores/model';
import styles from './SquarePanel.module.css';

function PortraitPreview({ src }: { src?: string }) {
  if (src) {
    return <img src={src} alt="" className={styles.portraitImg} />;
  }
  return <span className={styles.portraitPlaceholder}>?</span>;
}

function CharacterCard({ item }: { item: SquareCharacter }) {
  const [expanded, setExpanded] = useState(false);
  const { templates, loadAll, saveCharacter, createFromTemplate } = useRoleplayStore();

  return (
    <div
      className={styles.characterCard}
      onClick={() => setExpanded(v => !v)}
      title={expanded ? '点击收起' : '点击查看详情'}
    >
      <div className={styles.portraitArea}>
        <PortraitPreview src={item.portraitBase64} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{item.name}</div>
        <div className={styles.cardUser}>by {item.userName}</div>
        {item.personality && (
          <div className={styles.cardDesc}>{item.personality}</div>
        )}
        <div className={styles.cardMeta}>
          {item.gender && <span className={styles.cardTag}>{item.gender}</span>}
          {item.occupation && <span className={styles.cardTag}>{item.occupation}</span>}
        </div>
        {expanded && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            {item.background ? (
              <div style={{ marginBottom: 6, lineHeight: 1.5 }}>{item.background}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelCard({ item }: { item: SquareModel }) {
  return (
    <div className={styles.modelItem}>
      <div className={styles.modelInfo}>
        <div className={styles.modelName}>{item.name}</div>
        <div className={styles.modelMeta}>
          <span className={styles.modelProvider}>{item.provider}</span>
          <span>{item.modelId}</span>
          {item.contextWindow > 0 && <span>{item.contextWindow >= 1000 ? `${(item.contextWindow / 1000).toFixed(0)}K` : item.contextWindow} ctx</span>}
        </div>
      </div>
      <div className={styles.modelUser}>by {item.userName}</div>
    </div>
  );
}

export default function SquarePanel() {
  const {
    characters, models, loading, error,
    loadCharacters, loadModels, clearError,
  } = useSquareStore();
  const [tab, setTab] = useState<'characters' | 'models'>('characters');

  useEffect(() => {
    clearError();
    void loadCharacters();
    void loadModels();
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'characters' ? styles.tabActive : ''}`}
          onClick={() => setTab('characters')}
        >
          角色 ({characters.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'models' ? styles.tabActive : ''}`}
          onClick={() => setTab('models')}
        >
          模型 ({models.length})
        </button>
      </div>

      <div className={styles.body}>
        {error && <div className={styles.error}>{error}</div>}
        {loading && <div className={styles.loading}>加载中…</div>}

        {tab === 'characters' && !loading && (
          characters.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>广场暂无角色</div>
              <div>还没有用户分享角色到广场。在角色管理中点击「☁」分享到广场吧！</div>
            </div>
          ) : (
            <div className={styles.characterGrid}>
              {characters.map(c => (
                <CharacterCard key={c.id} item={c} />
              ))}
            </div>
          )
        )}

        {tab === 'models' && !loading && (
          models.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>广场暂无模型</div>
              <div>还没有用户分享模型到广场。在模型设置中分享你的模型配置吧！</div>
            </div>
          ) : (
            <div className={styles.modelList}>
              {models.map(m => (
                <ModelCard key={m.id} item={m} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
