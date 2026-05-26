import React, { useEffect, useState } from 'react';
import { useAgentStore, SubAgentStatus } from '../../stores/agent';
import {
  SUB_AGENT_TYPE_META,
  computeSubAgentProgress,
  formatElapsed,
  formatSubAgentActivityLine,
  summarizeSubAgents,
} from './subAgentUi';
import styles from './AgentProcessPanel.module.css';

function SubAgentCard({ sa, now }: { sa: SubAgentStatus; now: number }) {
  const meta = SUB_AGENT_TYPE_META[sa.type];
  const progress = computeSubAgentProgress(sa);
  const isRunning = sa.status === 'running' || sa.status === 'spawning';
  const statusLabel = sa.status === 'completed'
    ? '已完成'
    : sa.status === 'failed'
      ? '失败'
      : '运行中';
  const activityLine = formatSubAgentActivityLine(sa);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.icon} style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.icon}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>
            {meta.label}
            {(sa.waveIndex ?? 0) > 1 && (
              <span className={styles.waveBadge}>批次 {sa.waveIndex}</span>
            )}
          </div>
          <div className={styles.cardDesc} title={sa.description || sa.targetPath}>
            {sa.description || sa.targetPath || '并行子任务'}
          </div>
        </div>
        <div className={styles.timer}>
          {statusLabel} {formatElapsed(sa.startTime, sa.endTime ?? (isRunning ? now : sa.endTime))}
        </div>
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%`, background: meta.color }}
          />
        </div>
        <span className={styles.progressPct}>{progress}%</span>
      </div>

      {activityLine && (
        <div className={styles.activityLine} title={sa.currentFile || activityLine}>
          <span className={styles.activityText}>{activityLine}</span>
        </div>
      )}
      {sa.error && <div className={styles.errorText}>{sa.error}</div>}
    </div>
  );
}

export default function AgentProcessPanel() {
  const { subAgents } = useAgentStore();
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());

  const hasRunning = subAgents.some(sa => sa.status === 'running' || sa.status === 'spawning');
  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunning]);

  if (subAgents.length === 0) return null;

  const { running, completed, failed, total, avgProgress } = summarizeSubAgents(subAgents);
  const waveCount = new Set(subAgents.map(sa => sa.waveIndex ?? 1)).size;
  const remainingEstimate = hasRunning
    ? formatElapsed(Date.now() - avgProgress * 1000)
    : '00:00';

  const scrollToReport = () => {
    const chatScroll = document.querySelector('[data-chat-scroll="true"]');
    chatScroll?.scrollTo({ top: chatScroll.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>Agent Process</div>
          <div className={styles.statusLine}>
            {hasRunning
              ? `运行中 (${running}/${total})${waveCount > 1 ? ` · ${waveCount} 批` : ''}`
              : failed > 0
                ? `已结束 (${completed} 成功, ${failed} 失败)${waveCount > 1 ? ` · ${waveCount} 批` : ''}`
                : `已完成 (${total}/${total})${waveCount > 1 ? ` · ${waveCount} 批` : ''}`}
          </div>
        </div>
        <button type="button" className={styles.collapseBtn} onClick={() => setCollapsed(v => !v)}>
          {collapsed ? '展开详情' : '收起详情'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className={styles.list}>
            {subAgents.map(sa => (
              <SubAgentCard key={sa.id} sa={sa} now={now} />
            ))}
          </div>

          <div className={styles.summary}>
            <div className={styles.summaryTitle}>汇总进度</div>
            <div className={styles.summaryProgressRow}>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${avgProgress}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                />
              </div>
              <span className={styles.progressPct}>{avgProgress}%</span>
            </div>
            <div className={styles.summaryMeta}>
              <span>{hasRunning ? `预计剩余 ${remainingEstimate}` : '全部子代理已结束'}</span>
              <span>
                {running > 0
                  ? `${running} 个运行中`
                  : failed > 0
                    ? `${failed} 个失败，${completed} 个成功`
                    : `${total} 个已成功`}
              </span>
            </div>
            <button type="button" className={styles.viewReportBtn} onClick={scrollToReport}>
              查看最终回复
            </button>
          </div>
        </>
      )}
    </div>
  );
}
