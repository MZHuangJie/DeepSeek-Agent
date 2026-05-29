import React, { useEffect, useState } from 'react';
import { useSyncStore } from '../../stores/sync';
import { useAuthStore } from '../../stores/auth';
import { useChatStore } from '../../stores/chat';
import styles from './CloudSyncPanel.module.css';

interface Props {
  onClose: () => void;
  onOpenLogin: () => void;
}

export default function CloudSyncPanel({ onClose, onOpenLogin }: Props) {
  const { user, status } = useAuthStore();
  const { sessions } = useChatStore();
  const {
    cloudSessions, loading, error, lastSyncAt,
    loadCloudSessions, pushSession, pullSession, deleteCloudSession, clearError,
  } = useSyncStore();

  const isLoggedIn = status === 'authenticated' && user;
  const [pullingId, setPullingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      void loadCloudSessions();
    }
  }, [isLoggedIn, loadCloudSessions]);

  const handlePushCurrent = async () => {
    const { activeSessionId } = useChatStore.getState();
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const payload = JSON.stringify({
      messages: session.messages,
      characterId: session.characterId,
      characterIds: session.characterIds,
      sessionMode: session.sessionMode,
      planTodos: session.planTodos,
      planDocPath: session.planDocPath,
    });
    const ok = await pushSession(session.id, session.title, payload);
    if (ok) {
      void loadCloudSessions();
    }
  };

  const handlePull = async (id: string) => {
    setPullingId(id);
    clearError();
    const data = await pullSession(id);
    if (data) {
      await useChatStore.getState().loadSessions();
    }
    setPullingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除云端会话？')) return;
    setDeletingId(id);
    const ok = await deleteCloudSession(id);
    setDeletingId(null);
  };

  if (!isLoggedIn) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.panel} onClick={e => e.stopPropagation()}>
          <div className={styles.header}>
            <span className={styles.title}>☁ 云端会话</span>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>登录后即可备份会话到云端</div>
            <button className={styles.primaryBtn} onClick={onOpenLogin}>去登录</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>☁ 云端会话</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={styles.linkBtn}
              onClick={() => void loadCloudSessions()}
              disabled={loading}
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>×</button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <button className={styles.primaryBtn} onClick={() => void handlePushCurrent()}>
            备份当前会话
          </button>
          {lastSyncAt && (
            <span className={styles.hint}>
              上次同步 {new Date(lastSyncAt).toLocaleTimeString('zh-CN')}
            </span>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.list}>
          {cloudSessions.length === 0 && !loading && (
            <div className={styles.empty}>云端暂无备份的会话</div>
          )}
          {cloudSessions.map(c => (
            <div key={c.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <div className={styles.itemTitle}>{c.title}</div>
                <div className={styles.itemMeta}>
                  {c.messageCount} 条消息 · {new Date(c.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => void handlePull(c.id)}
                  disabled={pullingId === c.id}
                >
                  {pullingId === c.id ? '拉取中…' : '恢复'}
                </button>
                <button
                  className={styles.actionBtnDanger}
                  onClick={() => void handleDelete(c.id)}
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? '删除中…' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
