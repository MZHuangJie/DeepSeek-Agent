import { create } from 'zustand';

export interface ToolCallEntry {
  id: string;
  name: string;
  args: string;
  result?: string;
  status: 'running' | 'success' | 'error';
  timestamp: number;
}

export interface TokenStats {
  total: number;
  prompt: number;
  completion: number;
  toolTokens?: number;
  contextWindow: number;
  contextMax: number;
  cost: number;
}

export interface SubAgentStatus {
  id: string;
  type: 'explore' | 'analyze' | 'implement' | 'review';
  targetPath: string;
  status: 'spawning' | 'running' | 'completed' | 'failed';
  filesProcessed: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  summary?: string;
  findings: string[];
  error?: string;
  startTime: number;
  endTime?: number;
}

interface AgentState {
  currentStep: {
    step: number;
    total: number;
    description: string;
    progress: number;
    readPercentage?: number;
    readFileCount?: number;
    totalFiles?: number;
  } | null;
  toolCalls: ToolCallEntry[];
  tokenStats: TokenStats | null;
  subAgents: SubAgentStatus[];
  exploreProgress: {
    readPercentage: number;
    readFileCount: number;
    totalFiles: number;
    step: number;
    total: number;
    unreadDirs?: string[];
    warning?: string;
  } | null;
  setCurrentStep: (step: AgentState['currentStep']) => void;
  addToolCall: (tc: ToolCallEntry) => void;
  updateToolCall: (id: string, update: Partial<ToolCallEntry>) => void;
  setTokenStats: (stats: TokenStats) => void;
  addSubAgent: (subAgent: SubAgentStatus) => void;
  updateSubAgent: (id: string, update: Partial<SubAgentStatus>) => void;
  removeSubAgent: (id: string) => void;
  setExploreProgress: (p: AgentState['exploreProgress']) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  currentStep: null,
  toolCalls: [],
  tokenStats: null,
  subAgents: [],
  exploreProgress: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  addToolCall: (tc) => set(s => ({ toolCalls: [...s.toolCalls, tc] })),
  updateToolCall: (id, update) => set(s => ({
    toolCalls: s.toolCalls.map(t => t.id === id ? { ...t, ...update } : t),
  })),
  setTokenStats: (stats) => set({ tokenStats: stats }),
  addSubAgent: (subAgent) => set(s => ({ subAgents: [...s.subAgents, subAgent] })),
  updateSubAgent: (id, update) => set(s => ({
    subAgents: s.subAgents.map(sa => sa.id === id ? { ...sa, ...update } : sa),
  })),
  removeSubAgent: (id) => set(s => ({
    subAgents: s.subAgents.filter(sa => sa.id !== id),
  })),
  setExploreProgress: (p) => set({ exploreProgress: p }),
  reset: () => set({ currentStep: null, toolCalls: [], tokenStats: null, subAgents: [], exploreProgress: null }),
}));
