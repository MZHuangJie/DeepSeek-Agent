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
  /** 主 Agent 自身消耗（不含子代理） */
  mainTotal?: number;
  mainPrompt?: number;
  mainCompletion?: number;
  /** 所有子代理合计 */
  subAgentTotal?: number;
  subAgentPrompt?: number;
  subAgentCompletion?: number;
}

function sumSubAgentTokens(subAgents: SubAgentStatus[]) {
  return subAgents.reduce(
    (acc, sa) => ({
      prompt: acc.prompt + (sa.tokenUsage?.prompt ?? 0),
      completion: acc.completion + (sa.tokenUsage?.completion ?? 0),
      total: acc.total + (sa.tokenUsage?.total ?? 0),
    }),
    { prompt: 0, completion: 0, total: 0 },
  );
}

function aggregateTokenStats(main: TokenStats, subAgents: SubAgentStatus[]): TokenStats {
  const sub = sumSubAgentTokens(subAgents);
  const total = main.total + sub.total;
  return {
    ...main,
    prompt: main.prompt + sub.prompt,
    completion: main.completion + sub.completion,
    total,
    mainTotal: main.total,
    mainPrompt: main.prompt,
    mainCompletion: main.completion,
    subAgentTotal: sub.total,
    subAgentPrompt: sub.prompt,
    subAgentCompletion: sub.completion,
    cost: parseFloat((total * 0.000002).toFixed(3)),
  };
}

export interface SubAgentStatus {
  id: string;
  type: 'explore' | 'analyze' | 'implement' | 'review';
  description?: string;
  targetPath: string;
  status: 'spawning' | 'running' | 'completed' | 'failed';
  filesProcessed: number;
  progress?: number;
  activityText?: string;
  currentFile?: string;
  currentTool?: string;
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
  waveIndex?: number;
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
  mainTokenStats: TokenStats | null;
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
  setMainTokenStats: (stats: TokenStats) => void;
  refreshAggregatedTokenStats: () => void;
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
  mainTokenStats: null,
  subAgents: [],
  exploreProgress: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  addToolCall: (tc) => set(s => ({ toolCalls: [...s.toolCalls, tc] })),
  updateToolCall: (id, update) => set(s => ({
    toolCalls: s.toolCalls.map(t => t.id === id ? { ...t, ...update } : t),
  })),
  setTokenStats: (stats) => set({ tokenStats: stats }),
  setMainTokenStats: (stats) => set({
    mainTokenStats: stats,
    tokenStats: aggregateTokenStats(stats, get().subAgents),
  }),
  refreshAggregatedTokenStats: () => {
    const main = get().mainTokenStats;
    if (!main) return;
    set({ tokenStats: aggregateTokenStats(main, get().subAgents) });
  },
  addSubAgent: (subAgent) => set(s => {
    const subAgents = [...s.subAgents, subAgent];
    const main = s.mainTokenStats;
    return {
      subAgents,
      ...(main ? { tokenStats: aggregateTokenStats(main, subAgents) } : {}),
    };
  }),
  updateSubAgent: (id, update) => set(s => {
    const subAgents = s.subAgents.map(sa => sa.id === id ? { ...sa, ...update } : sa);
    const main = s.mainTokenStats;
    return {
      subAgents,
      ...(main ? { tokenStats: aggregateTokenStats(main, subAgents) } : {}),
    };
  }),
  removeSubAgent: (id) => set(s => {
    const subAgents = s.subAgents.filter(sa => sa.id !== id);
    const main = s.mainTokenStats;
    return {
      subAgents,
      ...(main ? { tokenStats: aggregateTokenStats(main, subAgents) } : {}),
    };
  }),
  setExploreProgress: (p) => set({ exploreProgress: p }),
  reset: () => set({
    currentStep: null,
    toolCalls: [],
    tokenStats: null,
    mainTokenStats: null,
    subAgents: [],
    exploreProgress: null,
  }),
}));
