import React, { useEffect, useState } from 'react';
import { useConversationStore, CloudSessionDeps } from '../../stores/conversationStore';
import { useAgentRolesStore, AgentRole } from '../../stores/agentRoles';
import { useRoleplayStore } from '../../stores/roleplay';
import { useSyncStore } from '../../stores/sync';
import { useToastStore } from '../../stores/toast';
import styles from './CloudRestoreDialog.module.css';

interface CloudSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

interface Props {
  onClose: () => void;
}

export default function CloudRestoreDialog({ onClose }: Props) {
  const [sessions, setSessions] = useState<CloudSessionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deps, setDeps] = useState<CloudSessionDeps | null>(null);
  const [importingDeps, setImportingDeps] = useState(false);

  const restoreCloudSession = useConversationStore(s => s.restoreCloudSession);
  const checkCloudSessionDeps = useConversationStore(s => s.checkCloudSessionDeps);
  const importRole = useAgentRolesStore(s => s.importRole);
  const loadAll = useConversationStore(s => s.loadAll);

  useEffect(() => {
    loadCloudList();
  }, []);

  async function loadCloudList() {
    setLoading(true);
    try {
      const res = await window.api.sync.listSessions();
      if (res?.sessions) {
        const cloudSessions = res.sessions as CloudSessionMeta[];
        cloudSessions.sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(cloudSessions);
      }
    } catch { /* not logged in or network error */ }
    setLoading(false);
  }

  async function handleRestore(session: CloudSessionMeta) {
    setRestoringId(session.id);
    setDeps(null);
    try {
      const result = await checkCloudSessionDeps(session.id);
      if (!result) {
        useToastStore.getState().show('获取云端会话失败', 'error');
        setRestoringId(null);
        return;
      }
      const totalMissing = result.missingAgents.length + result.missingNpcIds.length;
      if (totalMissing === 0) {
        // 无依赖缺失，直接恢复
        const conv = await restoreCloudSession(session.id);
        if (conv) {
          useToastStore.getState().show(`已恢复「${conv.title}」`, 'success');
          setRestoringId(null);
          loadCloudList();
        }
      } else {
        setDeps(result);
      }
    } catch (err) {
      useToastStore.getState().show('恢复失败', 'error');
      setRestoringId(null);
    }
  }

  async function handleImportAllAndRestore() {
    if (!deps) return;
    setImportingDeps(true);
    try {
      // 导入缺失的 Agent 角色
      for (const member of deps.missingAgents) {
        const role: AgentRole = {
          id: member.roleId || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: member.name,
          systemPrompt: member.systemPrompt,
          modelId: member.modelId,
        };
        await importRole(role);
      }
      // 从云端拉取 NPC 角色
      for (const charId of deps.cloudNpcIds) {
        const charRes = await window.api.sync.getCharacter(charId);
        if (charRes?.payload) {
          try {
            const parsed = JSON.parse(charRes.payload);
            await window.api.roleplay.saveCharacter({
              id: charId,
              templateId: parsed.templateId,
              name: parsed.name || charId,
              gender: parsed.gender,
              occupation: parsed.occupation,
              personality: parsed.personality,
              background: parsed.background,
              body: parsed.body,
              openingStory: parsed.openingStory,
              statusFieldEnabled: parsed.statusFieldEnabled,
              portraitPath: parsed.portraitBase64
                ? await window.api.files.saveBase64Image(parsed.portraitBase64, `portraits/${charId}`)
                : undefined,
              portraitFullPath: parsed.portraitFullBase64
                ? await window.api.files.saveBase64Image(parsed.portraitFullBase64, `portraits/${charId}-full`)
                : undefined,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          } catch { /* skip failed character restore */ }
        }
      }
      // 恢复会话
      const conv = await restoreCloudSession(deps.sessionId);
      if (conv) {
        await loadAll();
        useToastStore.getState().show(`已恢复「${conv.title}」并导入 ${deps.missingAgents.length + deps.cloudNpcIds.length} 个依赖`, 'success');
      }
      onClose();
    } catch (err) {
      useToastStore.getState().show('导入失败', 'error');
    }
    setImportingDeps(false);
  }

  async function handleSkipAndRestore() {
    if (!deps) return;
    setImportingDeps(true);
    try {
      const conv = await restoreCloudSession(deps.sessionId);
      if (conv) {
        useToastStore.getState().show(`已恢复「${conv.title}」（跳过了 ${deps.missingAgents.length + deps.missingNpcIds.length} 个依赖）`, 'success');
      }
      onClose();
    } catch {
      useToastStore.getState().show('恢复失败', 'error');
    }
    setImportingDeps(false);
  }

  function handleCancelDeps() {
    setDeps(null);
    setRestoringId(null);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>云端会话</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {deps ? (
          <div className={styles.body}>
            <div className={styles.depsTitle}>恢复「{deps.sessionTitle}」需要以下依赖：</div>

            {deps.missingAgents.length > 0 && (
              <div className={styles.depSection}>
                <div className={styles.depLabel}>🤖 缺失的 Agent 角色（可从会话数据导入）</div>
                {deps.missingAgents.map(m => (
                  <div key={m.roleId || m.name} className={styles.depItem}>
                    <span className={styles.depName}>{m.name}</span>
                    <span className={styles.depHint}>系统提示词: {m.systemPrompt?.slice(0, 60)}…</span>
                  </div>
                ))}
              </div>
            )}

            {deps.cloudNpcIds.length > 0 && (
              <div className={styles.depSection}>
                <div className={styles.depLabel}>👤 缺失的 NPC 角色（可从云端拉取）</div>
                {deps.cloudNpcIds.map(id => (
                  <div key={id} className={styles.depItem}>
                    <span className={styles.depName}>{id}</span>
                    <span className={styles.depHint}>云端有存档</span>
                  </div>
                ))}
              </div>
            )}

            {deps.unrecoverableNpcIds.length > 0 && (
              <div className={styles.depSection}>
                <div className={styles.depLabel}>⚠️ 无法恢复的 NPC 角色（本地和云端均不存在）</div>
                {deps.unrecoverableNpcIds.map(id => (
                  <div key={id} className={styles.depItem}>
                    <span className={styles.depName}>{id}</span>
                    <span className={styles.depHint}>立绘和状态面板将不可用</span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.depActions}>
              <button className={styles.primaryBtn} onClick={handleImportAllAndRestore} disabled={importingDeps}>
                {importingDeps ? '导入中…' : '全部导入并恢复'}
              </button>
              <button className={styles.secondaryBtn} onClick={handleSkipAndRestore} disabled={importingDeps}>
                跳过直接恢复
              </button>
              <button className={styles.secondaryBtn} onClick={handleCancelDeps}>取消</button>
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            {loading ? (
              <div className={styles.hint}>加载中…</div>
            ) : sessions.length === 0 ? (
              <div className={styles.hint}>云端没有会话。新创建的会话会自动同步。</div>
            ) : (
              <div className={styles.list}>
                {sessions.map(s => (
                  <div key={s.id} className={styles.sessionRow}>
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionTitle}>{s.title}</div>
                      <div className={styles.sessionMeta}>
                        {s.messageCount || 0} 条消息 · {new Date(s.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className={styles.restoreBtn}
                      disabled={restoringId === s.id}
                      onClick={() => handleRestore(s)}
                    >
                      {restoringId === s.id ? '检测中…' : '恢复'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
