import React from 'react';
import { useAgentStore, ToolCallEntry } from '../../stores/agent';

function ToolCallRow({ tc }: { tc: ToolCallEntry }) {
  const statusIcon = tc.status === 'running' ? <img src="/assets/8.png" alt="running" style={{ width: 12, height: 12 }} /> : tc.status === 'success' ? <img src="/assets/6.png" alt="success" style={{ width: 12, height: 12 }} /> : <img src="/assets/12.png" alt="error" style={{ width: 12, height: 12 }} />;
  const time = new Date(tc.timestamp).toLocaleTimeString();
  const isSubAgentTool = tc.name === 'spawn_sub_agent' || tc.name === 'auto_decompose_task';

  return (
    <div style={{
      fontSize: 11,
      padding: isSubAgentTool ? '6px 8px' : '4px 0',
      marginBottom: isSubAgentTool ? 4 : 0,
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: isSubAgentTool ? 'rgba(79, 195, 247, 0.08)' : 'transparent',
      borderLeft: isSubAgentTool ? '2px solid #4fc3f7' : 'none',
      borderRadius: isSubAgentTool ? 3 : 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{statusIcon}</span>
        {isSubAgentTool && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            background: '#4fc3f7',
            padding: '1px 5px',
            borderRadius: 3,
            letterSpacing: 0.3,
          }}>子代理</span>
        )}
        <span style={{ color: isSubAgentTool ? '#4fc3f7' : 'var(--accent)', fontWeight: 500 }}>{tc.name}</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', fontSize: 10 }}>{time}</span>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2, paddingLeft: 20, wordBreak: 'break-word' }}>
        {tc.args}
      </div>
      {tc.result && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2, paddingLeft: 20, opacity: 0.7, maxHeight: 40, overflow: 'hidden' }}>
          {tc.result.slice(0, 100)}
        </div>
      )}
    </div>
  );
}

export default function ToolTimeline() {
  const { toolCalls } = useAgentStore();

  return (
    <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
        工具调用时间线
      </div>
      {toolCalls.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>暂无工具调用</div>
      )}
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {toolCalls.map(tc => <ToolCallRow key={tc.id} tc={tc} />)}
      </div>
    </div>
  );
}
