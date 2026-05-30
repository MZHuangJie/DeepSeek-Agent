export type StatusFieldType = 'text' | 'number' | 'list';
export type StatusFieldSection = 'clothing' | 'state' | 'monologue';

import type { PortraitStyleId } from '../../common/portrait-styles';

export interface StatusFieldDef {
  key: string;
  label: string;
  type: StatusFieldType;
  section: StatusFieldSection;
  icon?: 'heart' | 'pulse' | 'trust' | 'custom';
  promptHint?: string;
  enabled?: boolean;
  /** 用户手动添加的字段 */
  custom?: boolean;
}

/** JSON 字段名：与配置中的「状态名称」一致 */
export function getStatusFieldKey(field: StatusFieldDef): string {
  return (field.label || field.key).trim();
}

/** 兼容旧版英文 key 的模型输出 */
const LEGACY_STATUS_KEYS: Record<string, string> = {
  clothing: '服装',
  mood: '情绪',
  heartRate: '心率',
  trust: '信任值',
  monologue: '内心独白',
};

export function formatStatusValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join('、');
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

export function resolveStatusValue(
  status: Record<string, unknown>,
  field: StatusFieldDef,
): unknown {
  const primary = getStatusFieldKey(field);
  if (status[primary] !== undefined && status[primary] !== null && status[primary] !== '') {
    return status[primary];
  }
  if (field.key && status[field.key] !== undefined) return status[field.key];
  const legacyKey = Object.entries(LEGACY_STATUS_KEYS).find(([, label]) => label === field.label)?.[0];
  if (legacyKey && status[legacyKey] !== undefined) return status[legacyKey];
  return undefined;
}

export function normalizeStatusFields(fields: StatusFieldDef[]): StatusFieldDef[] {
  const seen = new Set<string>();
  return fields
    .map(f => {
      const label = (f.label || f.key || '').trim();
      if (!label) return null;
      let key = label;
      let n = 2;
      while (seen.has(key)) {
        key = `${label}_${n++}`;
      }
      seen.add(key);
      return {
        key,
        label,
        type: f.type || 'text',
        section: f.section || 'state',
        icon: f.icon,
        promptHint: f.promptHint,
        enabled: f.enabled !== false,
        custom: f.custom,
      };
    })
    .filter((f): f is StatusFieldDef => Boolean(f));
}

export function createCustomStatusField(label = '新状态'): StatusFieldDef {
  return {
    key: label,
    label,
    type: 'text',
    section: 'state',
    enabled: true,
    custom: true,
    promptHint: '',
  };
}

export const DEFAULT_STATUS_FIELDS: StatusFieldDef[] = [
  {
    key: '服装',
    label: '服装',
    type: 'list',
    section: 'clothing',
    enabled: true,
    promptHint: '当前穿着，字符串数组，如 ["黑色宽松针织毛衣", "深色居家短裤"]',
  },
  {
    key: '情绪',
    label: '情绪',
    type: 'text',
    section: 'state',
    icon: 'heart',
    enabled: true,
    promptHint: '当前情绪，如：害羞、压抑、内心挣扎',
  },
  {
    key: '心率',
    label: '心率',
    type: 'number',
    section: 'state',
    icon: 'pulse',
    enabled: true,
    promptHint: '每分钟心跳次数，数字，如 101',
  },
  {
    key: '信任值',
    label: '信任值',
    type: 'text',
    section: 'state',
    icon: 'trust',
    enabled: true,
    promptHint: '格式如 +2 (当前: 28/100)',
  },
  {
    key: '内心独白',
    label: '内心独白',
    type: 'text',
    section: 'monologue',
    enabled: true,
    promptHint: '角色此刻未说出口的内心想法，1-3 句',
  },
];

export interface BodyMeasurements {
  height?: string;
  weight?: string;
  bust?: string;
  waist?: string;
  hips?: string;
  shoulders?: string;
  arms?: string;
  legs?: string;
  skin?: string;
  hair?: string;
  eyes?: string;
  other?: string;
}

export interface RoleplayTemplate {
  id: string;
  name: string;
  gender?: string;
  occupation?: string;
  personality?: string;
  background?: string;
  body?: BodyMeasurements;
  openingStory?: string;
  portraitPath?: string;
  /** 点击角色卡片时弹出的查看大图 */
  portraitFullPath?: string;
  statusFields?: StatusFieldDef[];
  createdAt: number;
  updatedAt: number;
}

export interface RoleplayCharacter {
  id: string;
  templateId?: string;
  name: string;
  gender?: string;
  occupation?: string;
  personality?: string;
  background?: string;
  body?: BodyMeasurements;
  openingStory?: string;
  portraitPath?: string;
  /** 点击角色卡片时弹出的查看大图 */
  portraitFullPath?: string;
  /** 角色级：覆盖模板中各状态字段是否启用（key -> enabled） */
  statusFieldEnabled?: Record<string, boolean>;
  /** @deprecated 旧数据：完整状态字段副本，新角色请只用 statusFieldEnabled */
  statusFields?: StatusFieldDef[];
  createdAt: number;
  updatedAt: number;
}

export type CharacterFormData = Omit<RoleplayCharacter, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  /** 模板编辑时写入完整 statusFields；角色编辑时写入 statusFieldEnabled */
  statusFields?: StatusFieldDef[];
  /** 仅 AI 生成立绘时使用，不持久化 */
  portraitStyle?: PortraitStyleId;
};

export const BODY_FIELDS: Array<{ key: keyof BodyMeasurements; label: string }> = [
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

export type PortraitGenerateStage = 'prompt' | 'image';

export type { PortraitStyleId } from '../../common/portrait-styles';
export {
  PORTRAIT_STYLE_OPTIONS,
  PORTRAIT_STYLE_GROUPS,
  DEFAULT_PORTRAIT_STYLE,
  resolvePortraitStyle,
  getPortraitStylesByGroup,
} from '../../common/portrait-styles';

export const PORTRAIT_GEN_STAGE_LABELS: Record<PortraitGenerateStage, string> = {
  prompt: '正在根据角色信息生成英文提示词…',
  image: '正在调用生图模型生成立绘，请稍候…',
};

export function emptyCharacterForm(name = '新角色'): CharacterFormData {
  return { name, body: {} };
}

export function emptyTemplateForm(name = '新模板'): CharacterFormData {
  return { name, body: {}, statusFields: cloneStatusFields() };
}

export function cloneStatusFields(fields = DEFAULT_STATUS_FIELDS): StatusFieldDef[] {
  return fields.map(f => ({ ...f }));
}

export function getTemplateById(
  templates: RoleplayTemplate[],
  templateId?: string,
): RoleplayTemplate | null {
  if (!templateId) return null;
  return templates.find(t => t.id === templateId) ?? null;
}

export function getTemplateStatusFieldDefs(template?: RoleplayTemplate | null): StatusFieldDef[] {
  if (template?.statusFields?.length) return normalizeStatusFields(template.statusFields);
  return normalizeStatusFields(DEFAULT_STATUS_FIELDS);
}

export function buildCharacterStatusEnabledMap(
  character: Pick<RoleplayCharacter, 'statusFieldEnabled' | 'statusFields'>,
  template?: RoleplayTemplate | null,
): Record<string, boolean> {
  const defs = getTemplateStatusFieldDefs(template);
  const map: Record<string, boolean> = {};
  for (const field of defs) {
    const key = field.key;
    if (character.statusFieldEnabled && key in character.statusFieldEnabled) {
      map[key] = character.statusFieldEnabled[key];
    } else if (character.statusFields?.length) {
      const legacy = character.statusFields.find(f => f.key === key || f.label === field.label);
      map[key] = legacy ? legacy.enabled !== false : field.enabled !== false;
    } else {
      map[key] = field.enabled !== false;
    }
  }
  return map;
}

export function getEffectiveStatusFields(
  character?: Pick<RoleplayCharacter, 'statusFieldEnabled' | 'statusFields' | 'templateId'> | null,
  template?: RoleplayTemplate | null,
): StatusFieldDef[] {
  if (!character) return normalizeStatusFields(DEFAULT_STATUS_FIELDS).filter(f => f.enabled !== false);

  if (!template && character.statusFields?.length) {
    return normalizeStatusFields(character.statusFields).filter(f => f.enabled !== false);
  }

  const defs = getTemplateStatusFieldDefs(template);
  const enabledMap = buildCharacterStatusEnabledMap(character, template);
  return defs.filter(f => enabledMap[f.key] !== false);
}

export function characterFromTemplate(template: RoleplayTemplate): CharacterFormData {
  return {
    templateId: template.id,
    name: template.name,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    background: template.background,
    body: template.body ? { ...template.body } : {},
    openingStory: template.openingStory,
    portraitPath: template.portraitPath,
    statusFieldEnabled: Object.fromEntries(
      getTemplateStatusFieldDefs(template).map(f => [f.key, f.enabled !== false]),
    ),
  };
}

export function templateFormFromTemplate(template: RoleplayTemplate): CharacterFormData {
  return {
    id: template.id,
    name: template.name,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    background: template.background,
    body: template.body ? { ...template.body } : {},
    openingStory: template.openingStory,
    portraitPath: template.portraitPath,
    statusFields: template.statusFields?.length
      ? cloneStatusFields(template.statusFields)
      : cloneStatusFields(),
  };
}

export function duplicateTemplateForm(template: RoleplayTemplate): CharacterFormData {
  const base = templateFormFromTemplate(template);
  return {
    ...base,
    id: undefined,
    name: `${template.name}（副本）`,
  };
}

function buildStatusOutputPrompt(fields: StatusFieldDef[]): string {
  if (fields.length === 0) return '';

  const schemaLines = fields.map(f => {
    const jsonKey = getStatusFieldKey(f);
    const typeHint = f.type === 'list' ? 'string[]' : f.type === 'number' ? 'number' : 'string';
    const hint = f.promptHint ? `，${f.promptHint}` : '';
    return `  "${jsonKey}": ${typeHint}${hint ? `  // ${hint}` : ''}`;
  });

  return [
    '',
    '## 回复格式（必须严格遵守）',
    '每轮回复必须使用以下 XML 结构，不要输出 markdown 代码块：',
    '',
    '<reply>',
    '（第三人称小说体叙事：场景/动作/神态/剧情推进 + 穿插台词，展示在对话气泡内）',
    '</reply>',
    '',
    '<status>',
    '{',
    ...schemaLines,
    '}',
    '</status>',
    '',
    '规则：',
    '- 【硬性要求】每一轮回复都必须同时包含 <reply> 和 <status>，包括开场与后续每一轮，无一例外',
    '- 禁止只输出 <reply> 而省略 <status>；缺少任一标签视为无效回复',
    '- <reply> 与 <status> 各出现一次，最后一行必须是 </status>',
    '- <status> 内必须是合法 JSON，字段名与上方完全一致',
    '- 根据当前情境更新各状态字段，数值字段用 number，列表字段用 string[]',
    '- 不要在 <reply> 内写 JSON 或状态信息',
    '- 不要使用 markdown 代码块包裹 JSON',
  ].join('\n');
}

/** 角色扮演叙事规范：第三人称、场景描写、主动推进剧情 */
export const ROLEPLAY_NARRATIVE_STYLE = [
  '## 叙事与文风（必须遵守）',
  '- 使用**第三人称**小说体（以角色名或「她/他」指代），禁止通篇第一人称「我…」',
  '- <reply> 不只是台词：需包含环境氛围、动作神态、心理外化，并**主动推进剧情**',
  '- 建议结构：① 场景/局势变化 ② 角色动作与表情（2-4 句） ③ 台词用「」穿插其中',
  '- 篇幅：每轮 <reply> 建议 150-400 字；开场可 250-500 字。避免只有一两句短回复',
  '- 禁止：替用户行动或发言；跳出角色解释规则；在 <reply> 内输出 JSON',
  '',
  '示例（仅示意文风，勿照抄）：',
  '林宛儿眼帘微垂，指尖划过课桌边缘。身后窃窃私语仍未停息，她却像听不见一般，只抬起下巴，淡声问：「有事？」',
].join('\n');

export function formatBody(body?: BodyMeasurements): string {
  if (!body) return '';
  return BODY_FIELDS
    .map(({ key, label }) => body[key] ? `- ${label}：${body[key]}` : '')
    .filter(Boolean)
    .join('\n');
}

export const ROLEPLAY_OPENING_USER_MESSAGE =
  '[系统] 请现在发送你的开场白，开启本轮角色扮演。用户尚未输入任何内容，请主动开场，不要等待用户先说话。';

export const ROLEPLAY_STATUS_RETRY_MESSAGE =
  '[系统] 你上一条回复格式不完整：缺少有效的 <status>...</status> 状态块。请根据当前对话情境，重新输出完整的一轮回复。必须同时包含 <reply>...</reply> 与 <status>...</status>，JSON 字段名与设定完全一致，不要向用户提及此系统提醒。';

export function buildCharacterPrompt(
  character: RoleplayCharacter,
  template?: RoleplayTemplate | null,
  options?: { forOpening?: boolean; playerName?: string },
): string {
  const lines: string[] = [`## 当前扮演角色：${character.name}`];
  if (character.gender) lines.push(`性别：${character.gender}`);
  if (character.occupation) lines.push(`职业：${character.occupation}`);
  if (character.personality) lines.push(`性格：${character.personality}`);
  if (character.background) lines.push(`故事背景：${character.background}`);

  const bodyText = formatBody(character.body);
  if (bodyText) lines.push(`身材：\n${bodyText}`);

  lines.push('\n请以该角色为叙述主体，用第三人称小说体回复，保持人设一致，不要跳出角色。');
  lines.push('', ROLEPLAY_NARRATIVE_STYLE);

  const statusPrompt = buildStatusOutputPrompt(getEffectiveStatusFields(character, template));
  if (statusPrompt) lines.push(statusPrompt);

  if (options?.playerName) {
    lines.push(`\n## 用户信息\n与你对话的用户叫「${options.playerName}」，请在对话中自然地称呼他/她。`);
  }

  if (options?.forOpening) {
    if (character.openingStory?.trim()) {
      lines.push(`\n## 开场情境\n${character.openingStory.trim()}`);
      if (!options?.playerName) {
        lines.push('你还不清楚用户的名字，请在开场白中自然地询问用户叫什么名字。');
      } else {
        lines.push('请立即发送第一条消息：以此情境自然开场。用户还没有发言。');
      }
    } else if (character.background?.trim()) {
      lines.push('\n## 开场');
      if (!options?.playerName) {
        lines.push('请立即发送第一条消息：根据故事背景自行生成合适开场白，并在开场中自然地询问用户叫什么名字。');
      } else {
        lines.push('请立即发送第一条消息：根据故事背景自行生成合适开场白。用户还没有发言。');
      }
    } else {
      lines.push('\n## 开场');
      if (!options?.playerName) {
        lines.push('请立即发送第一条消息：以第三人称小说体自然开场，含场景描写与剧情铺垫，并在开场中自然地询问用户叫什么名字。');
      } else {
        lines.push('请立即发送第一条消息：以第三人称小说体自然开场，含场景描写与剧情铺垫。用户还没有发言。');
      }
    }
  }

  return lines.join('\n');
}
