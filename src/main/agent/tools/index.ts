// 工具类型
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<string>;
  requiresConfirm?: boolean;
}

export interface MultiAgentRole {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  modelConfig: { model: string; baseUrl: string; apiKey?: string };
}

export interface ToolContext {
  apiKey: string;
  modelConfig: { model: string; baseUrl: string };
  contextMax: number;
  subAgentManager: any;
  imageModelConfig?: { baseUrl: string; model: string; apiKey: string };
  visionModelConfig?: { enabled?: boolean; baseUrl: string; model: string; apiKey: string };
  signal?: AbortSignal;
  projectDir?: string;
  /** Multi-Agent 模式下可分派的角色库（含每角色独立模型配置） */
  multiAgentRoles?: MultiAgentRole[];
}

// 安全工具
export { safeResolve, checkSensitiveFile, checkDangerousCommand } from './security';
