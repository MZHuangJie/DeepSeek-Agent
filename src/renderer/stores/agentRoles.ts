import { create } from 'zustand';
import type { ModelConfig } from './model';

export interface AgentRole {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  /** 角色使用的模型 ID（对应 model store 中的模型）；缺省时回退当前激活模型 */
  modelId?: string;
}

/** 发送给主进程的角色（已解析模型配置） */
export interface SendableAgentRole {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  modelConfig: { model: string; baseUrl: string; apiKey?: string };
}

const SETTINGS_KEY = 'multiAgentRoles';

interface AgentRolesState {
  roles: AgentRole[];
  loaded: boolean;
  loadRoles: () => Promise<void>;
  saveRoles: (roles: AgentRole[]) => Promise<void>;
}

export const useAgentRolesStore = create<AgentRolesState>((set) => ({
  roles: [],
  loaded: false,

  loadRoles: async () => {
    try {
      const saved = await window.api.settings.get(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          set({ roles: parsed, loaded: true });
          return;
        }
      }
    } catch {
      // ignore, use empty
    }
    set({ loaded: true });
  },

  saveRoles: async (roles) => {
    set({ roles });
    await window.api.settings.set(SETTINGS_KEY, JSON.stringify(roles));
  },
}));

/** 把角色的 modelId 解析为可发送的模型配置；找不到模型时回退到 fallbackModel */
export function resolveSendableRoles(
  roles: AgentRole[],
  models: ModelConfig[],
  fallbackModel: ModelConfig,
  globalApiKey: string,
): SendableAgentRole[] {
  return roles.map(role => {
    const model = models.find(m => m.id === role.modelId) ?? fallbackModel;
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      modelConfig: {
        model: model.model,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey || globalApiKey || undefined,
      },
    };
  });
}
