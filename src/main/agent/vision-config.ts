import { getSetting } from '../db/settings';
import type { VisionModelConfig } from '../services/vision';

export interface ResolvedVisionConfig extends VisionModelConfig {
  enabled: true;
}

function hostOf(baseUrl: string): string {
  try {
    const normalized = baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`;
    return new URL(normalized.replace(/\/+$/, '')).hostname;
  } catch {
    return '';
  }
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

  const visionHost = hostOf(useDedicated ? vision.baseUrl : modelConfig.baseUrl);
  const chatHost = hostOf(modelConfig.baseUrl);
  const needsDedicatedKey = useDedicated && visionHost && chatHost && visionHost !== chatHost;
  const resolvedApiKey = needsDedicatedKey
    ? (vision.apiKey?.trim() || '')
    : ((useDedicated ? vision.apiKey : apiKey) || apiKey).trim();

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
