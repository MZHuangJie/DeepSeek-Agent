import type { ImageModelConfig } from './imageGen';

export interface StoredImageModelConfig {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

/** 与聊天 generate_image 工具保持一致：必须启用生图模型，API Key 可回退到全局 Key */
export function resolveImageModelConfig(
  imageModelRaw: string | null | undefined,
  fallbackApiKey: string | null | undefined,
): ImageModelConfig | undefined {
  if (!imageModelRaw) return undefined;
  let cfg: StoredImageModelConfig;
  try {
    cfg = JSON.parse(imageModelRaw) as StoredImageModelConfig;
  } catch {
    return undefined;
  }
  if (!cfg.enabled || !cfg.baseUrl?.trim() || !cfg.model?.trim()) return undefined;

  const apiKey = cfg.apiKey?.trim() || fallbackApiKey?.trim() || '';
  if (!apiKey) return undefined;

  return {
    baseUrl: cfg.baseUrl.trim(),
    model: cfg.model.trim(),
    apiKey,
  };
}

/** 角色立绘默认尺寸：与聊天生图默认一致，避免中转站不支持竖版尺寸而挂起 */
export const DEFAULT_PORTRAIT_IMAGE_SIZE = '1024x1024';

export function buildPortraitImageArgs(prompt: string) {
  return {
    prompt,
    size: DEFAULT_PORTRAIT_IMAGE_SIZE,
    quality: 'high',
    n: 1,
  };
}
