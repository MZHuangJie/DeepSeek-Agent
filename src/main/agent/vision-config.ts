import { getSetting } from '../db/settings';
import type { VisionModelConfig } from '../services/vision';

export interface ResolvedVisionConfig extends VisionModelConfig {
  enabled: true;
}

/** 解析视觉模型配置：非多模态主模型强制独立 Vision；API Key 回退到对话 Key */
export function resolveVisionConfig(
  modelConfig: { model: string; baseUrl: string },
  apiKey: string,
  options?: { providerMultimodal?: boolean; visionRaw?: string | null },
): ResolvedVisionConfig | undefined {
  const raw = options?.visionRaw !== undefined ? options.visionRaw : getSetting('visionModel');
  if (!raw) return undefined;

  let vision: VisionModelConfig & { enabled?: boolean; useActiveModel?: boolean };
  try {
    vision = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!vision.enabled) return undefined;

  const providerMultimodal = options?.providerMultimodal ?? false;
  const useActiveModel = providerMultimodal && !!vision.useActiveModel;
  const useDedicated = !useActiveModel || !!vision.apiKey;

  const resolvedApiKey = (useDedicated ? vision.apiKey : apiKey) || apiKey;
  if (!resolvedApiKey) return undefined;

  return {
    enabled: true,
    baseUrl: useDedicated ? vision.baseUrl : modelConfig.baseUrl,
    model: useDedicated ? vision.model : modelConfig.model,
    apiKey: resolvedApiKey,
    useActiveModel,
  };
}

export function buildVisionToolContext(
  modelConfig: { model: string; baseUrl: string },
  apiKey: string,
  providerMultimodal?: boolean,
): ResolvedVisionConfig | undefined {
  return resolveVisionConfig(modelConfig, apiKey, { providerMultimodal });
}
