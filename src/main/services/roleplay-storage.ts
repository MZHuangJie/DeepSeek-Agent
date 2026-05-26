import fs from 'fs';
import path from 'path';
import { getSetting, setSetting } from '../db/settings';
import { getCurrentWorkspace } from '../ipc/files';
import {
  getAgentImagesDir,
  getPortraitFilePath,
  readAgentImageAsDataUrl,
} from './agent-images';

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

const TEMPLATES_KEY = 'roleplay:templates';
const CHARACTERS_KEY = 'roleplay:characters';
const ACTIVE_CHARACTER_KEY = 'roleplay:activeCharacterId';

const BUILTIN_TEMPLATES: RoleplayTemplate[] = [
  {
    id: 'tpl-blank',
    name: '空白模板',
    isBuiltin: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'tpl-modern',
    name: '现代都市',
    gender: '女',
    occupation: '咖啡师',
    personality: '温柔细腻，略带神秘',
    background: '在旧城巷弄经营一家深夜才开门的小咖啡馆，熟悉每位常客的故事。',
    body: { height: '165cm', hair: '深棕长发', eyes: '琥珀色' },
    isBuiltin: true,
    createdAt: 0,
    updatedAt: 0,
  },
];

function loadJson<T>(key: string, fallback: T): T {
  const raw = getSetting(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  setSetting(key, JSON.stringify(value));
}

export function getPortraitDir(projectDir = getCurrentWorkspace()): string {
  return getAgentImagesDir(projectDir);
}

export function readPortraitAsDataUrl(portraitPath: string, projectDir = getCurrentWorkspace()): string {
  return readAgentImageAsDataUrl(portraitPath, projectDir);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listTemplates(): RoleplayTemplate[] {
  const custom = loadJson<RoleplayTemplate[]>(TEMPLATES_KEY, []);
  const merged = [...BUILTIN_TEMPLATES];
  for (const t of custom) {
    if (!t.isBuiltin) merged.push(t);
  }
  return merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveTemplate(input: Omit<RoleplayTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltin'> & { id?: string }): RoleplayTemplate {
  if (input.id?.startsWith('tpl-') && BUILTIN_TEMPLATES.some(t => t.id === input.id)) {
    throw new Error('内置模板不可修改');
  }
  const custom = loadJson<RoleplayTemplate[]>(TEMPLATES_KEY, []);
  const now = Date.now();
  const existing = input.id ? custom.find(t => t.id === input.id) : undefined;
  const saved: RoleplayTemplate = {
    id: input.id || existing?.id || newId('tpl'),
    name: input.name.trim(),
    gender: input.gender?.trim() || undefined,
    occupation: input.occupation?.trim() || undefined,
    personality: input.personality?.trim() || undefined,
    background: input.background?.trim() || undefined,
    body: input.body,
    openingStory: input.openingStory?.trim() || undefined,
    portraitPath: input.portraitPath || existing?.portraitPath,
    isBuiltin: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!saved.name) throw new Error('模板名称不能为空');
  const next = existing
    ? custom.map(t => (t.id === saved.id ? saved : t))
    : [saved, ...custom];
  saveJson(TEMPLATES_KEY, next);
  return saved;
}

export function deleteTemplate(id: string): void {
  if (BUILTIN_TEMPLATES.some(t => t.id === id)) throw new Error('内置模板不可删除');
  const custom = loadJson<RoleplayTemplate[]>(TEMPLATES_KEY, []);
  saveJson(TEMPLATES_KEY, custom.filter(t => t.id !== id));
}

export function listCharacters(): RoleplayCharacter[] {
  return loadJson<RoleplayCharacter[]>(CHARACTERS_KEY, [])
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCharacter(id: string): RoleplayCharacter | null {
  return listCharacters().find(c => c.id === id) ?? null;
}

export function saveCharacter(input: Omit<RoleplayCharacter, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): RoleplayCharacter {
  const all = loadJson<RoleplayCharacter[]>(CHARACTERS_KEY, []);
  const now = Date.now();
  const existing = input.id ? all.find(c => c.id === input.id) : undefined;
  const saved: RoleplayCharacter = {
    id: input.id || existing?.id || newId('char'),
    templateId: input.templateId || existing?.templateId,
    name: input.name.trim(),
    gender: input.gender?.trim() || undefined,
    occupation: input.occupation?.trim() || undefined,
    personality: input.personality?.trim() || undefined,
    background: input.background?.trim() || undefined,
    body: input.body,
    openingStory: input.openingStory?.trim() || undefined,
    portraitPath: input.portraitPath || existing?.portraitPath,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!saved.name) throw new Error('角色姓名不能为空');
  const next = existing
    ? all.map(c => (c.id === saved.id ? saved : c))
    : [saved, ...all];
  saveJson(CHARACTERS_KEY, next);
  return saved;
}

export function deleteCharacter(id: string): void {
  const all = loadJson<RoleplayCharacter[]>(CHARACTERS_KEY, []);
  const target = all.find(c => c.id === id);
  saveJson(CHARACTERS_KEY, all.filter(c => c.id !== id));
  if (target?.portraitPath && fs.existsSync(target.portraitPath)) {
    try { fs.unlinkSync(target.portraitPath); } catch { /* ignore */ }
  }
  if (getActiveCharacterId() === id) setActiveCharacterId(null);
}

export function getActiveCharacterId(): string | null {
  const val = getSetting(ACTIVE_CHARACTER_KEY);
  return val && val.trim() ? val : null;
}

export function setActiveCharacterId(id: string | null) {
  if (id) setSetting(ACTIVE_CHARACTER_KEY, id);
  else setSetting(ACTIVE_CHARACTER_KEY, '');
}

export function copyPortraitFromFile(sourcePath: string, ownerId: string, projectDir = getCurrentWorkspace()): string {
  const ext = path.extname(sourcePath) || '.png';
  const dest = getPortraitFilePath(projectDir, ownerId, ext);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

export function createCharacterFromTemplate(templateId: string): RoleplayCharacter {
  const template = listTemplates().find(t => t.id === templateId);
  if (!template) throw new Error('模板不存在');
  const id = newId('char');
  let portraitPath: string | undefined;
  if (template.portraitPath && fs.existsSync(template.portraitPath)) {
    portraitPath = copyPortraitFromFile(template.portraitPath, id);
  }
  return saveCharacter({
    id,
    templateId,
    name: template.name === '空白模板' ? '新角色' : template.name,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    background: template.background,
    body: template.body ? { ...template.body } : undefined,
    openingStory: template.openingStory,
    portraitPath,
  });
}
