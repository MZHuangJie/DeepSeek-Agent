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

export type StatusFieldType = 'text' | 'number' | 'list';
export type StatusFieldSection = 'clothing' | 'state' | 'monologue';

export interface StatusFieldDef {
  key: string;
  label: string;
  type: StatusFieldType;
  section: StatusFieldSection;
  icon?: 'heart' | 'pulse' | 'trust' | 'custom';
  promptHint?: string;
  enabled?: boolean;
  custom?: boolean;
}

const TEMPLATES_KEY = 'roleplay:templates';
const CHARACTERS_KEY = 'roleplay:characters';
const ACTIVE_CHARACTER_KEY = 'roleplay:activeCharacterId';

const DEFAULT_STATUS_FIELDS: StatusFieldDef[] = [
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

function cloneStatusFields(fields = DEFAULT_STATUS_FIELDS): StatusFieldDef[] {
  return fields.map(f => ({ ...f }));
}

function buildStatusEnabledFromTemplate(template?: RoleplayTemplate): Record<string, boolean> {
  const defs = template?.statusFields?.length ? template.statusFields : DEFAULT_STATUS_FIELDS;
  return Object.fromEntries(defs.map(f => [f.key, f.enabled !== false]));
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
  portraitFullPath?: string;
  statusFieldEnabled?: Record<string, boolean>;
  /** @deprecated 旧数据 */
  statusFields?: StatusFieldDef[];
  createdAt: number;
  updatedAt: number;
}

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
  return loadJson<RoleplayTemplate[]>(TEMPLATES_KEY, [])
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveTemplate(input: Omit<RoleplayTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): RoleplayTemplate {
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
    portraitFullPath: input.portraitFullPath || existing?.portraitFullPath,
    statusFields: input.statusFields?.length
      ? input.statusFields
      : existing?.statusFields?.length
        ? existing.statusFields
        : cloneStatusFields(),
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
  const templateId = input.templateId || existing?.templateId;
  const template = templateId ? listTemplates().find(t => t.id === templateId) : undefined;
  let statusFieldEnabled = input.statusFieldEnabled ?? existing?.statusFieldEnabled;
  if (!statusFieldEnabled) {
    const legacyFields = input.statusFields?.length
      ? input.statusFields
      : existing?.statusFields;
    if (legacyFields?.length) {
      statusFieldEnabled = Object.fromEntries(
        legacyFields.map(f => [f.key, f.enabled !== false]),
      );
    } else {
      statusFieldEnabled = buildStatusEnabledFromTemplate(template);
    }
  }
  const saved: RoleplayCharacter = {
    id: input.id || existing?.id || newId('char'),
    templateId,
    name: input.name.trim(),
    gender: input.gender?.trim() || undefined,
    occupation: input.occupation?.trim() || undefined,
    personality: input.personality?.trim() || undefined,
    background: input.background?.trim() || undefined,
    body: input.body,
    openingStory: input.openingStory?.trim() || undefined,
    portraitPath: input.portraitPath || existing?.portraitPath,
    portraitFullPath: input.portraitFullPath || existing?.portraitFullPath,
    statusFieldEnabled,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!saved.name) throw new Error('角色姓名不能为空');
  if (!input.templateId && !existing && !input.statusFieldEnabled) throw new Error('角色必须从模板创建');
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
  let portraitFullPath: string | undefined;
  if (template.portraitFullPath && fs.existsSync(template.portraitFullPath)) {
    portraitFullPath = copyPortraitFromFile(template.portraitFullPath, `${id}-full`);
  }
  return saveCharacter({
    id,
    templateId,
    name: template.name,
    gender: template.gender,
    occupation: template.occupation,
    personality: template.personality,
    background: template.background,
    body: template.body ? { ...template.body } : undefined,
    openingStory: template.openingStory,
    portraitPath,
    portraitFullPath,
    statusFieldEnabled: buildStatusEnabledFromTemplate(template),
  });
}
