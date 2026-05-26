import { create } from 'zustand';
import { useAgentStore } from './agent';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderKey;
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow?: number;
}

export type ProviderKey = 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'qwen' | 'zhipu' | 'moonshot' | 'custom';

interface ProviderPreset {
  label: string;
  baseUrl: string;
  defaultModel: string;
  contextWindow: number;
  multimodal: boolean;
}

export const PROVIDERS: Record<ProviderKey, ProviderPreset> = {
  openai:     { label: 'OpenAI',             baseUrl: 'https://api.openai.com',                          defaultModel: 'gpt-4o',                  contextWindow: 128000,  multimodal: true },
  gemini:     { label: 'Google Gemini',      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash', contextWindow: 1048576, multimodal: true },
  anthropic:  { label: 'Anthropic Claude',   baseUrl: 'https://api.anthropic.com/v1',                     defaultModel: 'claude-sonnet-4-20250514', contextWindow: 200000,  multimodal: true },
  deepseek:   { label: 'DeepSeek',           baseUrl: 'https://api.deepseek.com',                        defaultModel: 'deepseek-chat',            contextWindow: 64000,   multimodal: false },
  qwen:       { label: '通义千问',            baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus',          contextWindow: 131072,  multimodal: true },
  zhipu:      { label: '智谱 GLM',           baseUrl: 'https://open.bigmodel.cn/api/paas/v4',            defaultModel: 'glm-4-plus',               contextWindow: 128000,  multimodal: true },
  moonshot:   { label: 'Moonshot',           baseUrl: 'https://api.moonshot.cn',                          defaultModel: 'moonshot-v1-8k',            contextWindow: 8000,    multimodal: false },
  custom:     { label: '自定义',              baseUrl: 'https://api.openai.com',                          defaultModel: 'gpt-4o',                  contextWindow: 128000,  multimodal: true },
};

export interface ImageModelConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    contextWindow: 64000,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    contextWindow: 64000,
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro',
    contextWindow: 1000000,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o',
    contextWindow: 128000,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
    contextWindow: 200000,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    contextWindow: 1048576,
  },
];

interface ModelState {
  models: ModelConfig[];
  activeModelId: string;
  imageModel: ImageModelConfig;
  visionModel: VisionModelConfig;
  loadModels: () => Promise<void>;
  saveModels: (models: ModelConfig[]) => Promise<void>;
  setActiveModel: (id: string) => Promise<void>;
  getActiveModel: () => ModelConfig;
  loadImageModel: () => Promise<void>;
  saveImageModel: (config: ImageModelConfig) => Promise<void>;
  loadVisionModel: () => Promise<void>;
  saveVisionModel: (config: VisionModelConfig) => Promise<void>;
}

export interface VisionModelConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  useActiveModel: boolean;
}

const DEFAULT_IMAGE_MODEL: ImageModelConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com',
  model: 'gpt-image-1',
  apiKey: '',
};

const DEFAULT_VISION_MODEL: VisionModelConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o',
  apiKey: '',
  useActiveModel: true,
};

export const useModelStore = create<ModelState>((set, get) => ({
  models: DEFAULT_MODELS,
  activeModelId: 'deepseek-chat',
  imageModel: DEFAULT_IMAGE_MODEL,
  visionModel: DEFAULT_VISION_MODEL,

  loadModels: async () => {
    try {
      const saved = await window.api.settings.get('models');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 兼容旧数据：已配模型用默认列表里的最新 contextWindow
        const migrated = parsed.map((m: ModelConfig) => {
          const def = DEFAULT_MODELS.find(d => d.id === m.id || d.model === m.model);
          return {
            ...m,
            contextWindow: def?.contextWindow ?? m.contextWindow ?? inferContextWindow(m.model),
          };
        });
        set({ models: migrated });
      }
      const active = await window.api.settings.get('activeModel');
      if (active && get().models.find(m => m.id === active)) {
        set({ activeModelId: active });
      }
    } catch {
      // use defaults
    }
  },

  saveModels: async (models) => {
    set({ models });
    await window.api.settings.set('models', JSON.stringify(models));
  },

  setActiveModel: async (id) => {
    set({ activeModelId: id });
    const model = get().models.find(m => m.id === id);
    if (model?.contextWindow) {
      const main = useAgentStore.getState().mainTokenStats;
      const stats = useAgentStore.getState().tokenStats;
      if (main) {
        useAgentStore.getState().setMainTokenStats({ ...main, contextMax: model.contextWindow });
      } else if (stats) {
        useAgentStore.getState().setTokenStats({ ...stats, contextMax: model.contextWindow });
      }
    }
    const { visionModel } = get();
    if (model && !PROVIDERS[model.provider]?.multimodal && visionModel.useActiveModel) {
      set({ visionModel: { ...visionModel, useActiveModel: false } });
    }
    await window.api.settings.set('activeModel', id);
  },

  getActiveModel: () => {
    const { models, activeModelId } = get();
    return models.find(m => m.id === activeModelId) ?? DEFAULT_MODELS[0];
  },

  loadImageModel: async () => {
    try {
      const saved = await window.api.settings.get('imageModel');
      if (saved) {
        const parsed = JSON.parse(saved);
        set({ imageModel: { ...DEFAULT_IMAGE_MODEL, ...parsed } });
      }
    } catch {
      // use default
    }
  },

  loadVisionModel: async () => {
    try {
      const saved = await window.api.settings.get('visionModel');
      if (saved) {
        const parsed = JSON.parse(saved);
        let config = { ...DEFAULT_VISION_MODEL, ...parsed };
        const active = get().getActiveModel();
        if (!PROVIDERS[active.provider]?.multimodal) {
          config = { ...config, useActiveModel: false };
        }
        set({ visionModel: config });
      }
    } catch {
      // use default
    }
  },

  saveVisionModel: async (config) => {
    set({ visionModel: config });
    await window.api.settings.set('visionModel', JSON.stringify(config));
  },

  saveImageModel: async (config) => {
    set({ imageModel: config });
    await window.api.settings.set('imageModel', JSON.stringify(config));
  },
}));

function inferContextWindow(modelId: string): number {
  if (modelId.includes('v4') || modelId.includes('4-pro') || modelId.includes('1m')) return 1000000;
  if (modelId.includes('128k')) return 128000;
  if (modelId.includes('32k')) return 32000;
  if (modelId.includes('8k')) return 8000;
  return 64000;
}
