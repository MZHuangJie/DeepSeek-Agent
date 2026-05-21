import { create } from 'zustand';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextWindow?: number;
}

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
];

interface ModelState {
  models: ModelConfig[];
  activeModelId: string;
  imageModel: ImageModelConfig;
  loadModels: () => Promise<void>;
  saveModels: (models: ModelConfig[]) => Promise<void>;
  setActiveModel: (id: string) => Promise<void>;
  getActiveModel: () => ModelConfig;
  loadImageModel: () => Promise<void>;
  saveImageModel: (config: ImageModelConfig) => Promise<void>;
}

const DEFAULT_IMAGE_MODEL: ImageModelConfig = {
  enabled: false,
  baseUrl: 'https://api.openai.com',
  model: 'gpt-image-1',
  apiKey: '',
};

export const useModelStore = create<ModelState>((set, get) => ({
  models: DEFAULT_MODELS,
  activeModelId: 'deepseek-chat',
  imageModel: DEFAULT_IMAGE_MODEL,

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
