import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { completeChat, type ModelConfig } from '../agent/client';
import { generateImage } from './imageGen';
import {
  resolveImageModelConfig,
  buildPortraitImageArgs,
} from './image-model-config';
import { getSetting } from '../db/settings';
import { getApiKey } from '../security/keystore';
import { getCurrentWorkspace } from '../ipc/files';
import {
  getPortraitFilePath,
  readAgentImageAsDataUrl,
} from './agent-images';
import type { BodyMeasurements } from './roleplay-storage';
import { resolvePortraitStyle } from '../../common/portrait-styles';
import {
  portraitInfo,
  portraitWarn,
  portraitError,
  maskSecret,
  truncateText,
  summarizeUrl,
} from './portrait-log';

export interface PortraitCharacterInput {
  name: string;
  gender?: string;
  occupation?: string;
  personality?: string;
  background?: string;
  body?: BodyMeasurements;
  portraitStyle?: string;
}

export type PortraitGenerateStage = 'prompt' | 'image';

export type PortraitGenerateProgress = (stage: PortraitGenerateStage) => void;

const BODY_LABELS: Array<{ key: keyof BodyMeasurements; label: string }> = [
  { key: 'height', label: '身高' },
  { key: 'weight', label: '体重' },
  { key: 'bust', label: '胸围' },
  { key: 'waist', label: '腰围' },
  { key: 'hips', label: '臀围' },
  { key: 'shoulders', label: '肩宽' },
  { key: 'arms', label: '手臂' },
  { key: 'legs', label: '腿部' },
  { key: 'skin', label: '肤色' },
  { key: 'hair', label: '发型/发色' },
  { key: 'eyes', label: '眼睛' },
  { key: 'other', label: '其他' },
];

function formatBody(body?: BodyMeasurements): string {
  if (!body) return '';
  return BODY_LABELS
    .map(({ key, label }) => (body[key] ? `- ${label}：${body[key]}` : ''))
    .filter(Boolean)
    .join('\n');
}

export function buildCharacterDescription(input: PortraitCharacterInput): string {
  const lines: string[] = [`姓名：${input.name}`];
  if (input.gender) lines.push(`性别：${input.gender}`);
  if (input.occupation) lines.push(`职业：${input.occupation}`);
  if (input.personality) lines.push(`性格：${input.personality}`);
  if (input.background) lines.push(`故事背景：${input.background}`);
  const bodyText = formatBody(input.body);
  if (bodyText) lines.push(`身材：\n${bodyText}`);
  return lines.join('\n');
}

function buildFallbackImagePrompt(input: PortraitCharacterInput): string {
  const style = resolvePortraitStyle(input.portraitStyle);
  const parts = [
    style.promptHint,
    'single character, full body or half body',
    input.gender ? `${input.gender}` : '',
    input.occupation ? `${input.occupation} outfit` : '',
    input.personality ? `personality: ${input.personality}` : '',
    input.body?.hair ? `hair: ${input.body.hair}` : '',
    input.body?.eyes ? `eyes: ${input.body.eyes}` : '',
    input.body?.skin ? `skin: ${input.body.skin}` : '',
    input.background ? `setting mood: ${input.background.slice(0, 120)}` : '',
    'high quality, detailed, clean background, no text, no watermark, no multiple people',
  ];
  return parts.filter(Boolean).join(', ');
}

function resolveActiveModel(): ModelConfig & { apiKey?: string } {
  const activeId = getSetting('activeModel') || 'deepseek-chat';
  const raw = getSetting('models');
  const defaults = [
    { id: 'deepseek-chat', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' },
    { id: 'gpt-4o', model: 'gpt-4o', baseUrl: 'https://api.openai.com' },
  ];
  let models: Array<{ id: string; model: string; baseUrl: string; apiKey?: string }> = defaults;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) models = parsed;
    } catch { /* use defaults */ }
  }
  const found = models.find(m => m.id === activeId) ?? models[0];
  return { model: found.model, baseUrl: found.baseUrl, apiKey: found.apiKey };
}

const DEFAULT_PROMPT_INSTRUCTION =
  '你是角色立绘提示词专家。根据中文角色设定与指定画风，输出一段英文图像生成提示词，用于生成单人角色立绘（半身或全身）。要求：只输出提示词本身，不要解释、不要 markdown。需包含外貌、服装、气质、构图，并严格体现用户指定的画风英文关键词。禁止文字、水印、多人、畸形肢体。';

async function generatePortraitPrompt(
  apiKey: string,
  modelConfig: ModelConfig,
  input: PortraitCharacterInput,
  promptInstruction?: string,
): Promise<string> {
  const description = buildCharacterDescription(input);
  const style = resolvePortraitStyle(input.portraitStyle);
  const titleModel = /reasoner|r1|thinking/i.test(modelConfig.model)
    ? 'deepseek-chat'
    : modelConfig.model;

  portraitInfo('prompt-request', {
    model: titleModel,
    baseUrl: modelConfig.baseUrl,
    apiKey: maskSecret(apiKey),
    characterName: input.name,
    portraitStyle: style.id,
    descriptionPreview: truncateText(description, 400),
    descriptionLength: description.length,
  });

  const started = Date.now();
  try {
    const content = await completeChat(
      apiKey,
      [
        {
          role: 'system',
          content: promptInstruction || DEFAULT_PROMPT_INSTRUCTION,
        },
        {
          role: 'user',
          content: `画风：${style.label}\n画风英文关键词（必须融入 prompt）：${style.promptHint}\n\n角色设定：\n${description}`,
        },
      ],
      { ...modelConfig, model: titleModel },
      { maxTokens: 500, temperature: 0.6, log: { module: 'roleplay-portrait', tag: 'prompt-llm' } },
    );
    const prompt = content.trim().replace(/^["'`]+|["'`]+$/g, '');
    if (prompt.length >= 20) {
      portraitInfo('prompt-response', {
        ms: Date.now() - started,
        promptPreview: truncateText(prompt, 400),
        promptLength: prompt.length,
        source: 'llm',
      });
      return prompt;
    }
    portraitWarn('prompt-too-short-use-fallback', {
      ms: Date.now() - started,
      promptPreview: truncateText(prompt, 200),
      promptLength: prompt.length,
    });
  } catch (err: unknown) {
    portraitWarn('prompt-llm-failed-use-fallback', {
      ms: Date.now() - started,
      model: titleModel,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const fallback = buildFallbackImagePrompt(input);
  portraitInfo('prompt-fallback', {
    promptPreview: truncateText(fallback, 400),
    promptLength: fallback.length,
  });
  return fallback;
}

function savePortraitFromBuffer(ownerId: string, data: Buffer, ext = '.png'): string {
  const dest = getPortraitFilePath(getCurrentWorkspace(), ownerId, ext);
  fs.writeFileSync(dest, data);
  portraitInfo('portrait-saved', {
    ownerId,
    path: dest,
    bytes: data.length,
    ext,
  });
  return dest;
}

function extFromMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.png';
}

function downloadUrl(url: string, authToken?: string): Promise<Buffer> {
  portraitInfo('download-start', {
    url: summarizeUrl(url),
    hasAuth: Boolean(authToken),
  });
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;
    const options = isHttps
      ? {
          hostname: parsed.hostname,
          servername: parsed.hostname,
          port: parsed.port || 443,
          path: parsed.pathname + parsed.search,
          method: 'GET' as const,
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        }
      : {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname + parsed.search,
          method: 'GET' as const,
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        };

    const req = requestFn(options, (res) => {
      if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400 && res.headers.location) {
        downloadUrl(res.headers.location, authToken).then(resolve).catch(reject);
        return;
      }
      if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
        portraitError('download-http-error', {
          url: summarizeUrl(url),
          status: res.statusCode ?? 0,
          ms: Date.now() - started,
        });
        reject(new Error(`下载立绘失败: HTTP ${res.statusCode ?? 0}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        portraitInfo('download-ok', {
          url: summarizeUrl(url),
          bytes: buffer.length,
          ms: Date.now() - started,
        });
        resolve(buffer);
      });
      res.on('error', (err) => {
        portraitError('download-stream-error', {
          url: summarizeUrl(url),
          error: err instanceof Error ? err.message : String(err),
          ms: Date.now() - started,
        });
        reject(err);
      });
    });
    req.on('error', (err) => {
      portraitError('download-network-error', {
        url: summarizeUrl(url),
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - started,
      });
      reject(err);
    });
    req.end();
  });
}

async function savePortraitFromGeneratedUrl(
  url: string,
  ownerId: string,
  authToken?: string,
): Promise<string> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('无效的图片数据');
    return savePortraitFromBuffer(ownerId, Buffer.from(match[2], 'base64'), extFromMime(match[1]));
  }
  const buffer = await downloadUrl(url, authToken);
  const ext = url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg') ? '.jpg'
    : url.toLowerCase().includes('.webp') ? '.webp' : '.png';
  return savePortraitFromBuffer(ownerId, buffer, ext);
}

export async function generateCharacterPortrait(
  ownerId: string,
  input: PortraitCharacterInput,
  onProgress?: PortraitGenerateProgress,
): Promise<{ portraitPath: string; prompt: string; dataUrl: string }> {
  const flowStarted = Date.now();
  portraitInfo('generate-start', {
    ownerId,
    characterName: input.name,
    gender: input.gender,
    occupation: input.occupation,
    portraitStyle: resolvePortraitStyle(input.portraitStyle).id,
  });

  try {
    if (!input.name?.trim()) throw new Error('请先填写角色姓名');
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('未配置 API Key，请在模型设置中配置');

    const imageModelRaw = getSetting('imageModel');
    const imageConfig = resolveImageModelConfig(imageModelRaw, apiKey);
    if (!imageConfig) {
      throw new Error('请先在「模型设置」中启用并配置生图模型（与聊天生图使用同一套配置）');
    }

    portraitInfo('image-config', {
      model: imageConfig.model,
      baseUrl: imageConfig.baseUrl,
      apiKey: maskSecret(imageConfig.apiKey),
    });

    const activeModel = resolveActiveModel();
    onProgress?.('prompt');
    const imagePrompt = await generatePortraitPrompt(
      activeModel.apiKey?.trim() || apiKey,
      activeModel,
      input,
      imageConfig.promptInstruction,
    );

    onProgress?.('image');
    portraitInfo('image-request', {
      promptPreview: truncateText(imagePrompt, 400),
      promptLength: imagePrompt.length,
    });

    let result;
    try {
      result = await generateImage(
        imageConfig,
        buildPortraitImageArgs(imagePrompt),
        undefined,
        'roleplay-portrait',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      portraitError('image-failed', { error: message });
      throw new Error(`生图失败：${message}`);
    }

    const url = result.urls[0];
    if (!url) {
      portraitError('image-no-url', { revisedPrompt: result.revisedPrompt });
      throw new Error('生图 API 未返回图片');
    }

    portraitInfo('image-result', {
      url: summarizeUrl(url),
      revisedPromptPreview: result.revisedPrompt ? truncateText(result.revisedPrompt, 200) : undefined,
    });

    const portraitPath = await savePortraitFromGeneratedUrl(url, ownerId, imageConfig.apiKey);
    const dataUrl = readAgentImageAsDataUrl(portraitPath, getCurrentWorkspace());

    portraitInfo('generate-success', {
      ownerId,
      portraitPath,
      dataUrlLength: dataUrl.length,
      ms: Date.now() - flowStarted,
    });

    return { portraitPath, prompt: result.revisedPrompt || imagePrompt, dataUrl };
  } catch (err: unknown) {
    portraitError('generate-failed', {
      ownerId,
      characterName: input.name,
      ms: Date.now() - flowStarted,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
