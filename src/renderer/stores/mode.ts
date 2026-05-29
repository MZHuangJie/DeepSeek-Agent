import { create } from 'zustand';

export type AgentMode = 'plan' | 'agent' | 'multi-agent' | 'chat' | 'roleplay';

interface ModeConfig {
  id: AgentMode;
  label: string;
  icon: string;
  description: string;
}

export const MODES: ModeConfig[] = [
  { id: 'plan', label: '计划', icon: '/assets/assistan.png', description: '只读分析代码，仅产出计划文档，不修改代码' },
  { id: 'agent', label: 'Agent', icon: '/assets/assistan.png', description: '单模型全工具：代码编写、调试、项目分析' },
  { id: 'multi-agent', label: 'Multi-Agent', icon: '/assets/assistan.png', description: '协调者把任务分派给多个配置角色并行执行' },
  { id: 'chat', label: '聊天', icon: '/assets/chat.png', description: '日常对话、问答' },
  { id: 'roleplay', label: '角色扮演', icon: '/assets/role.png', description: '本地 prompt + XML 状态，多模型可用' },
];

/** 兼容旧持久化值（coding → agent） */
export function normalizeMode(mode: string | null | undefined): AgentMode {
  if (mode === 'coding') return 'agent';
  if (MODES.some(m => m.id === mode)) return mode as AgentMode;
  return 'agent';
}

interface ModeState {
  mode: AgentMode;
  /** 上一次非角色扮演模式，用于关闭角色扮演开关时恢复 */
  lastNonRoleplayMode: AgentMode;
  setMode: (mode: AgentMode | string) => void;
  /** 角色扮演开关：开启切到 roleplay，关闭恢复上次编程/聊天模式 */
  setRoleplay: (on: boolean) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: 'agent',
  lastNonRoleplayMode: 'agent',
  setMode: (mode) => set(() => {
    const next = normalizeMode(mode);
    return next === 'roleplay'
      ? { mode: next }
      : { mode: next, lastNonRoleplayMode: next };
  }),
  setRoleplay: (on) => set((s) => on
    ? { mode: 'roleplay' }
    : { mode: s.lastNonRoleplayMode }),
}));
