import { create } from 'zustand';

export type AgentMode = 'coding' | 'chat' | 'roleplay';

interface ModeConfig {
  id: AgentMode;
  label: string;
  icon: string;
  description: string;
}

export const MODES: ModeConfig[] = [
  { id: 'coding', label: '编程助手', icon: '💻', description: '代码编写、调试、项目分析' },
  { id: 'chat', label: '聊天', icon: '💬', description: '日常对话、问答' },
  { id: 'roleplay', label: '角色扮演', icon: '🎭', description: '扮演特定角色进行对话' },
];

interface ModeState {
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: 'coding',
  setMode: (mode) => set({ mode }),
}));
