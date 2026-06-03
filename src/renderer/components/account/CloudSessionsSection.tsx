import React from 'react';
import styles from './AccountCenter.module.css';
import { IconTrash } from './AccountIcons';
import { useToastStore } from '../../stores/toast';
import { useConfirmStore } from '../../stores/confirm';
import { useChatStore } from '../../stores/chat';
import type { CloudSessionMeta } from '../../stores/sync';

interface Props {
  sessions: CloudSessionMeta[];
  localIds: Set<string>;
  error: string | null;
  pullSession: (id: string) => Promise<{ title: string; payload: string } | null>;
  deleteCloudSession: (id: string) => Promise<boolean>;
  loadCloudSessions: () => Promise<void>;
}

export default function CloudSessionsSection({ sessions, localIds, error, pullSession, deleteCloudSession, loadCloudSessions }: Props) {
  return (
    <div className={styles.pageScroll}>
      <div className={styles.pageHeader}>
        <h2>☁ 云端会话</h2>
        <span className={styles.pageSub}>共 {sessions.length} 个，可恢复到本地</span>
      </div>
      {error && (
        <div style={{ padding: '0 16px', fontSize: 12, color: '#fca5a5' }}>⚠ {error}</div>
      )}
      <div className={styles.cloudList}>
        {sessions.map(cs => {
          const alreadyLocal = localIds.has(cs.id);
          return (
            <div key={cs.id} className={styles.cloudItem}>
              <div className={styles.cloudItemInfo}>
                <div className={styles.cloudItemTitle}>{cs.title}</div>
                <div className={styles.cloudItemMeta}>{cs.messageCount} 条消息 · {(cs.updatedAt && !isNaN(Number(cs.updatedAt))) ? new Date(Number(cs.updatedAt)).toLocaleString('zh-CN') : ''}</div>
              </div>
              <button type="button" className={styles.cloudItemAction} disabled={alreadyLocal}
                onClick={async () => {
                  const data = await pullSession(cs.id);
                  if (!data) { useToastStore.getState().show('拉取失败', 'error'); return; }
                  try {
                    await window.api.sessions.save(cs.id, data.title || '恢复会话', data.payload);
                    await useChatStore.getState().loadSessions();
                    useToastStore.getState().show(`「${cs.title}」已恢复到本地，可在聊天面板中查看`, 'success');
                  } catch {
                    useToastStore.getState().show('解析会话数据失败', 'error');
                  }
                }}>
                {alreadyLocal ? '已同步' : '恢复到本地'}
              </button>
              <button type="button" className={styles.cloudDeleteBtn} style={{ position: 'static', marginLeft: 8 }}
                title="删除云端会话"
                onClick={(e) => {
                  e.stopPropagation();
                  useConfirmStore.getState().show({
                    message: `确定删除云端会话「${cs.title}」？`,
                    onConfirm: async () => {
                      const ok = await deleteCloudSession(cs.id);
                      if (ok) { useToastStore.getState().show(`已删除「${cs.title}」`, 'success'); void loadCloudSessions(); }
                      else { useToastStore.getState().show('删除失败', 'error'); }
                    },
                  });
                }}>
                <IconTrash />
              </button>
            </div>
          );
        })}
        {sessions.length === 0 && <div className={styles.emptyCard}>暂无云端会话，可在聊天面板中上传</div>}
      </div>
    </div>
  );
}
