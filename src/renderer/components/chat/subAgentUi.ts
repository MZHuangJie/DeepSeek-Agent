import { SubAgentStatus } from '../../stores/agent';

export const SUB_AGENT_TYPE_META: Record<SubAgentStatus['type'], { label: string; icon: string; color: string }> = {
  explore: { label: '代码探索代理', icon: '🔍', color: '#6366f1' },
  analyze: { label: '架构分析代理', icon: '🏗', color: '#8b5cf6' },
  implement: { label: '实现代理', icon: '⚙', color: '#22c55e' },
  review: { label: '审查代理', icon: '🧪', color: '#f59e0b' },
};

export function formatElapsed(start: number, end?: number): string {
  const totalSec = Math.max(0, Math.floor(((end ?? Date.now()) - start) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function computeSubAgentProgress(sa: SubAgentStatus): number {
  if (sa.status === 'completed') return 100;
  if (typeof sa.progress === 'number') return sa.progress;
  return Math.min(92, sa.filesProcessed * 7 + Math.floor(sa.tokenUsage.total / 900));
}

export function buildToolActivity(name: string, argsRaw?: string): { activityText: string; currentFile?: string } {
  try {
    const args = JSON.parse(argsRaw || '{}');
    const path = typeof args.path === 'string' ? args.path : undefined;
    switch (name) {
      case 'read_file':
        return { activityText: path ? `正在读取 ${basename(path)}` : '正在读取文件...', currentFile: path };
      case 'list_files':
        return { activityText: path ? `正在列出目录 ${basename(path)}` : '正在列出目录...', currentFile: path };
      case 'grep':
        return { activityText: '正在搜索代码内容...', currentFile: path };
      case 'write_file':
      case 'edit_file':
        return { activityText: path ? `正在修改 ${basename(path)}` : '正在修改文件...', currentFile: path };
      default:
        return { activityText: `正在执行 ${name}...`, currentFile: path };
    }
  } catch {
    return { activityText: `正在执行 ${name}...` };
  }
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function formatSubAgentActivityLine(sa: SubAgentStatus): string | null {
  const parts: string[] = [];
  if (sa.activityText) parts.push(sa.activityText);
  if (sa.currentFile) parts.push(basename(sa.currentFile));
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

export function isUsefulSubAgentSnippet(text: string): boolean {
  const snippet = text.replace(/\s+/g, ' ').trim();
  if (snippet.length < 4) return false;
  if (/^[\(\[\{:\-·•。，、\s]+$/.test(snippet)) return false;
  return true;
}

export function summarizeSubAgents(subAgents: SubAgentStatus[]) {
  const running = subAgents.filter(sa => sa.status === 'running' || sa.status === 'spawning').length;
  const completed = subAgents.filter(sa => sa.status === 'completed').length;
  const failed = subAgents.filter(sa => sa.status === 'failed').length;
  const avgProgress = subAgents.length === 0
    ? 0
    : Math.round(subAgents.reduce((sum, sa) => sum + computeSubAgentProgress(sa), 0) / subAgents.length);
  return { running, completed, failed, total: subAgents.length, avgProgress };
}
