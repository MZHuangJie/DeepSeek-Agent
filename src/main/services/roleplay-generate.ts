import { completeChat, type ModelConfig } from '../agent/client';
import { getSetting } from '../db/settings';
import { getApiKey } from '../security/keystore';
import type { StatusFieldDef } from '../../renderer/utils/roleplay';

export interface GeneratedTemplateData {
  name: string;
  gender?: string;
  occupation?: string;
  personality?: string;
  background?: string;
  openingStory?: string;
  body?: Record<string, string>;
  statusFields?: StatusFieldDef[];
}

export interface GeneratedCharacterData {
  name: string;
  gender?: string;
  occupation?: string;
  personality?: string;
  background?: string;
  body?: Record<string, string>;
}

function resolveActiveModel(): ModelConfig {
  const activeId = getSetting('activeModel') || 'deepseek-chat';
  const raw = getSetting('models');
  const defaults = [
    { id: 'deepseek-chat', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com' },
  ];
  let models: Array<{ id: string; model: string; baseUrl: string }> = defaults;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) models = parsed;
    } catch { /* use defaults */ }
  }
  const found = models.find(m => m.id === activeId) ?? models[0];
  return { model: found.model, baseUrl: found.baseUrl };
}

const STATUS_FIELD_KEYS = ['key', 'label', 'type', 'section', 'promptHint', 'enabled'] as const;

function validateStatusField(f: unknown): f is StatusFieldDef {
  if (!f || typeof f !== 'object') return false;
  const o = f as Record<string, unknown>;
  return typeof o.key === 'string' && o.key.length > 0
    && typeof o.label === 'string' && o.label.length > 0
    && (o.type === 'text' || o.type === 'number' || o.type === 'list')
    && (o.section === 'clothing' || o.section === 'state' || o.section === 'monologue');
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();
  return cleaned;
}

const TEMPLATE_SYSTEM_PROMPT = `你是一个角色扮演模版生成器。根据用户提供的关键词，随机生成一个完整的角色扮演模版。

要求：
1. 名称要有创意，不要用通用名
2. 性格要具体、生动、有层次
3. 背景故事要丰富、有戏剧张力，给出具体世界观设定
4. 开场故事是给 AI 的写作起点，描述一个具体场景，有画面感，100-300字
5. 身材(body)字段至少包含：hair(发型发色)、eyes(眼睛)、skin(肤色)、height(身高)，可选其他
6. statusFields 必须生成 3-6 个符合模版主题的状态字段，类型覆盖 state/clothing/monologue 三种分区：
   - state(状态): 数字或文本，如生命值、好感度、理智值
   - clothing(服装): 文本或列表，如当前服装、装备
   - monologue(独白): 文本，角色内心想法
   每个字段: key(英文驼峰), label(中文), type(text|number|list), section, promptHint(给模型的说明), enabled:true

只输出 JSON，不要任何解释或 markdown 包裹。`;

const CHARACTER_SYSTEM_PROMPT = `你是一个角色生成器。根据用户提供的模版信息，在该模版框架内随机生成一个具体角色。

要求：
1. 名称要符合世界观设定，有特点
2. 性格、背景要在模版框架内做随机变化，不要完全照抄模版
3. 身材(body)随机生成，符合角色设定
4. gender、occupation 可以在模版基础上调整

只输出 JSON，不要任何解释或 markdown 包裹。`;

export async function generateRandomTemplate(keywords: string): Promise<GeneratedTemplateData | null> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('未配置 API Key');
  const modelConfig = resolveActiveModel();

  try {
    const content = await completeChat(
      apiKey,
      [
        { role: 'system', content: TEMPLATE_SYSTEM_PROMPT },
        { role: 'user', content: `关键词：${keywords}` },
      ],
      modelConfig,
      { maxTokens: 2000, temperature: 1.0, timeoutMs: 60_000, log: { module: 'roleplay-generate', tag: 'template' } },
    );

    const json = JSON.parse(cleanJsonResponse(content));

    if (!json.name || typeof json.name !== 'string') {
      console.warn('[roleplay-generate] 模版 JSON 缺少 name 字段');
      return null;
    }

    const result: GeneratedTemplateData = {
      name: json.name,
      gender: typeof json.gender === 'string' ? json.gender : undefined,
      occupation: typeof json.occupation === 'string' ? json.occupation : undefined,
      personality: typeof json.personality === 'string' ? json.personality : undefined,
      background: typeof json.background === 'string' ? json.background : undefined,
      openingStory: typeof json.openingStory === 'string' ? json.openingStory : undefined,
      body: json.body && typeof json.body === 'object' ? json.body : undefined,
      statusFields: Array.isArray(json.statusFields)
        ? json.statusFields.filter(validateStatusField).map((f: any) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            section: f.section,
            promptHint: f.promptHint || '',
            enabled: f.enabled !== false,
          }))
        : undefined,
    };

    return result;
  } catch (err) {
    console.error('[roleplay-generate] 生成模版失败:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateRandomCharacter(template: GeneratedTemplateData): Promise<GeneratedCharacterData | null> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('未配置 API Key');
  const modelConfig = resolveActiveModel();

  const templateDesc = JSON.stringify({
    name: template.name,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    background: template.background,
    body: template.body,
  }, null, 2);

  try {
    const content = await completeChat(
      apiKey,
      [
        { role: 'system', content: CHARACTER_SYSTEM_PROMPT },
        { role: 'user', content: `模版信息：\n${templateDesc}\n\n请随机生成一个符合该模版的具体角色。` },
      ],
      modelConfig,
      { maxTokens: 1000, temperature: 1.0, timeoutMs: 45_000, log: { module: 'roleplay-generate', tag: 'character' } },
    );

    const json = JSON.parse(cleanJsonResponse(content));

    if (!json.name || typeof json.name !== 'string') {
      console.warn('[roleplay-generate] 角色 JSON 缺少 name 字段');
      return null;
    }

    return {
      name: json.name,
      gender: typeof json.gender === 'string' ? json.gender : template.gender,
      occupation: typeof json.occupation === 'string' ? json.occupation : template.occupation,
      personality: typeof json.personality === 'string' ? json.personality : template.personality,
      background: typeof json.background === 'string' ? json.background : template.background,
      body: json.body && typeof json.body === 'object' ? json.body : template.body,
    };
  } catch (err) {
    console.error('[roleplay-generate] 生成角色失败:', err instanceof Error ? err.message : err);
    return null;
  }
}
