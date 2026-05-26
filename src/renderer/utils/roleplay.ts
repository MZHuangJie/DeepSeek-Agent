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
  isBuiltin?: boolean;
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
  createdAt: number;
  updatedAt: number;
}

export type CharacterFormData = Omit<RoleplayCharacter, 'id' | 'createdAt' | 'updatedAt' | 'templateId'> & {
  id?: string;
  templateId?: string;
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

export const PORTRAIT_GEN_STAGE_LABELS: Record<PortraitGenerateStage, string> = {
  prompt: '正在根据角色信息生成英文提示词…',
  image: '正在调用生图模型生成立绘，请稍候…',
};

export function emptyCharacterForm(name = '新角色'): CharacterFormData {
  return { name, body: {} };
}

export function characterFromTemplate(template: RoleplayTemplate): CharacterFormData {
  return {
    name: template.name === '空白模板' ? '新角色' : template.name,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    background: template.background,
    body: template.body ? { ...template.body } : {},
    openingStory: template.openingStory,
    portraitPath: template.portraitPath,
  };
}

export function formatBody(body?: BodyMeasurements): string {
  if (!body) return '';
  return BODY_FIELDS
    .map(({ key, label }) => body[key] ? `- ${label}：${body[key]}` : '')
    .filter(Boolean)
    .join('\n');
}

export function buildCharacterPrompt(character: RoleplayCharacter): string {
  const lines: string[] = [`## 当前扮演角色：${character.name}`];
  if (character.gender) lines.push(`性别：${character.gender}`);
  if (character.occupation) lines.push(`职业：${character.occupation}`);
  if (character.personality) lines.push(`性格：${character.personality}`);
  if (character.background) lines.push(`故事背景：${character.background}`);

  const bodyText = formatBody(character.body);
  if (bodyText) lines.push(`身材：\n${bodyText}`);

  lines.push('\n请完全以该角色身份回复，保持人设一致，不要跳出角色。');

  if (character.openingStory?.trim()) {
    lines.push(`\n## 开场情境\n${character.openingStory.trim()}`);
    lines.push('若这是对话的第一轮，请以此情境自然开场。');
  } else if (character.background?.trim()) {
    lines.push('\n## 开场');
    lines.push('若这是对话的第一轮且用户尚未发言具体内容，请根据故事背景自行生成合适的开场白。');
  }

  return lines.join('\n');
}
