import React, { useEffect, useRef } from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';
import styles from './ToolTimeline.module.css';

function ToolCallRow({ tc }: { tc: ToolCallEntry }) {
  const isRunning = tc.status === 'running';
  const statusIcon = isRunning
    ? <img src="/assets/8.png" alt="running" className={styles.iconImg} />
    : tc.status === 'success'
      ? <img src="/assets/6.png" alt="success" className={styles.iconImg} />
      : <img src="/assets/12.png" alt="error" className={styles.iconImg} />;
  const time = new Date(tc.timestamp).toLocaleTimeString();
  const isSubAgentTool = tc.name === 'spawn_sub_agent' || tc.name === 'auto_decompose_task';

  const rowClass = [
    styles.row,
    isSubAgentTool ? styles.rowSubAgent : '',
    isRunning ? styles.rowRunning : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      <div className={styles.rowTop}>
        <span className={styles.statusIcon}>{statusIcon}</span>
        {isSubAgentTool && <span className={styles.subAgentBadge}>子代理</span>}
        <span className={isSubAgentTool ? styles.toolNameSubAgent : styles.toolNameDefault}>
          {tc.name}
        </span>
        {isRunning && <span className={styles.runningTag}>执行中</span>}
        <span className={styles.time}>{time}</span>
      </div>
      <div className={styles.args}>{tc.args}</div>
      {tc.result && (
        <div className={styles.result}>{tc.result.slice(0, 200)}</div>
      )}
    </div>
  );
}

export default function ToolTimeline() {
  const { toolCalls } = useAgentStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [toolCalls]);

  const runningCount = toolCalls.filter(tc => tc.status === 'running').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        工具调用时间线
        {runningCount > 0 && (
          <span className={styles.runningCount}>{runningCount} 个运行中</span>
        )}
      </div>
      {toolCalls.length === 0 && (
        <div className={styles.empty}>暂无工具调用</div>
      )}
      <div className={styles.list}>
        {toolCalls.map(tc => <ToolCallRow key={tc.id} tc={tc} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
