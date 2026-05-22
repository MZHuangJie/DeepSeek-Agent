// 工具类型
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context?: ToolContext) => Promise<string>;
  requiresConfirm?: boolean;
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
}

// 安全工具
export { safeResolve, checkSensitiveFile, checkDangerousCommand } from './security';
