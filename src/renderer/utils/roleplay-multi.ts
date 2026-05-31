import type { RoleplayCharacter, RoleplayTemplate, StatusFieldDef } from './roleplay';
import {
  buildCharacterPrompt,
  formatBody,
  getEffectiveStatusFields,
  getTemplateById,
  ROLEPLAY_NARRATIVE_STYLE,
  ROLEPLAY_OPENING_USER_MESSAGE,
  ROLEPLAY_STATUS_RETRY_MESSAGE,
} from './roleplay';
import type { RoleplayTurn } from './parseRoleplayResponse';

export interface MappedRoleplayTurn {
  characterId: string;
  characterName: string;
  reply: string;
  status?: Record<string, unknown>;
  statusComplete?: boolean;
}

export function mapTurnsToMeta(
  turns: RoleplayTurn[],
  participants: RoleplayCharacter[],
): MappedRoleplayTurn[] {
  return turns.map(turn => {
    const character = resolveCharacterByName(participants, turn.character);
    return {
      characterId: character?.id ?? turn.character,
      characterName: character?.name ?? turn.character,
      reply: turn.reply,
      status: turn.status,
      statusComplete: turn.statusComplete,
    };
  });
}

export interface RoleplaySessionCast {
  participantIds: string[];
  isMulti: boolean;
}

export function resolveSessionCast(session?: {
  characterId?: string;
  characterIds?: string[];
  /** @deprecated 旧版群聊曾让用户扮演某一 NPC，现已改为用户本人参与 */
  userCharacterId?: string;
} | null): RoleplaySessionCast {
  const participantIds = session?.characterIds?.length
    ? [...session.characterIds]
    : session?.characterId
      ? [session.characterId]
      : [];
  const isMulti = participantIds.length >= 2;
  return { participantIds, isMulti };
}

/** 会话未绑定角色时，回退到侧栏当前选中角色（角色扮演单聊） */
export function resolveEffectiveCast(
  session: Parameters<typeof resolveSessionCast>[0],
  activeCharacterId: string | null | undefined,
  mode: 'roleplay' | string,
): RoleplaySessionCast {
  const cast = resolveSessionCast(session);
  if (cast.participantIds.length > 0) return cast;
  if (mode === 'roleplay' && activeCharacterId) {
    return { participantIds: [activeCharacterId], isMulti: false };
  }
  return cast;
}

export function getCharactersByIds(
  characters: RoleplayCharacter[],
  ids: string[],
): RoleplayCharacter[] {
  return ids
    .map(id => characters.find(c => c.id === id))
    .filter((c): c is RoleplayCharacter => Boolean(c));
}

export function resolveCharacterByName(
  characters: RoleplayCharacter[],
  name: string,
): RoleplayCharacter | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return (
    characters.find(c => c.name === trimmed)
    ?? characters.find(c => c.name.toLowerCase() === trimmed.toLowerCase())
    ?? null
  );
}

function buildCharacterStatusSchemaLines(
  character: RoleplayCharacter,
  template: RoleplayTemplate | null | undefined,
): string[] {
  const fields = getEffectiveStatusFields(character, template);
  return fields.map(f => {
    const jsonKey = f.label || f.key;
    const typeHint = f.type === 'list' ? 'string[]' : f.type === 'number' ? 'number' : 'string';
    const hint = f.promptHint ? `  // ${f.promptHint}` : '';
    return `    "${jsonKey}": ${typeHint}${hint}`;
  });
}

function buildNpcSheet(character: RoleplayCharacter): string[] {
  const lines = [`### ${character.name}`];
  if (character.gender) lines.push(`- 性别：${character.gender}`);
  if (character.occupation) lines.push(`- 职业：${character.occupation}`);
  if (character.personality) lines.push(`- 性格：${character.personality}`);
  if (character.background) lines.push(`- 背景：${character.background}`);
  const bodyText = formatBody(character.body);
  if (bodyText) lines.push(`- 身材：\n${bodyText}`);
  return lines;
}

function buildMultiStatusFormatPrompt(
  npcs: Array<{ character: RoleplayCharacter; fields: StatusFieldDef[]; schemaLines: string[] }>,
): string {
  const schemaBlocks = npcs.map(({ character, schemaLines }) => {
    if (schemaLines.length === 0) {
      return `角色「${character.name}」的 <status> 可输出 {}`;
    }
    return [
      `角色「${character.name}」的 <status> JSON 字段：`,
      '{',
      ...schemaLines,
      '}',
    ].join('\n');
  });

  return [
    '',
    ROLEPLAY_NARRATIVE_STYLE,
    '',
    '## 回复格式（群像模式，必须严格遵守）',
    '每轮回复使用以下 XML 结构，不要输出 markdown 代码块：',
    '',
    '<scene>',
    '  <turn character="角色名">',
    '    <reply>（该 NPC 的第三人称叙事：场景/动作/神态 + 穿插台词）</reply>',
    '    <status>{ 该角色对应 JSON }</status>',
    '  </turn>',
    '  <!-- 可有多个 turn，仅包含本轮应发言的相关 NPC -->',
    '</scene>',
    '',
    '各 NPC 状态 JSON  schema：',
    ...schemaBlocks,
    '',
    '规则：',
    '- 【硬性要求】仅输出 NPC 的 turn；不要替用户（玩家本人）输出 turn',
    '- 【硬性要求】每轮只让**与当前情境相关**的 NPC 发言，无关 NPC 不要输出 turn',
    '- 每个 turn 的 character 属性必须与角色名完全一致',
    '- 每个 turn 必须同时包含 <reply> 与 <status>',
    '- 不要使用 markdown 代码块包裹 JSON',
    '- 最后一行必须是 </scene>',
  ].join('\n');
}

export const ROLEPLAY_GROUP_OPENING_USER_MESSAGE =
  '[系统] 请现在开启群像角色扮演开场。用户尚未发言。请仅让与开场相关的 NPC 以 <scene><turn>...</turn></scene> 格式发言，不要替用户本人输出 turn。';

export const ROLEPLAY_GROUP_STATUS_RETRY_MESSAGE =
  '[系统] 你上一条群像回复格式不完整：部分 turn 缺少有效的 <status>，或错误输出了用户本人的 turn。请根据当前对话情境重新输出完整 <scene>，仅包含相关 NPC，每个 turn 必须有 <reply> 与 <status>，不要向用户提及此系统提醒。';

export function buildGroupRoleplayPrompt(
  participants: RoleplayCharacter[],
  templates: RoleplayTemplate[],
  options?: { forOpening?: boolean },
): string {
  const lines: string[] = [
    '## 群像角色扮演',
    '用户以**玩家本人**身份参与场景（用户台词由用户直接输入，你不要替用户输出 turn，也不要把 NPC 名当作用户名）。',
    '',
    '## 在场 NPC',
  ];

  const npcSchema = participants.map(character => {
    const template = getTemplateById(templates, character.templateId);
    lines.push(...buildNpcSheet(character), '');
    return {
      character,
      fields: getEffectiveStatusFields(character, template),
      schemaLines: buildCharacterStatusSchemaLines(character, template),
    };
  });

  lines.push(
    '请以导演视角推进场景：只让相关 NPC 回应或行动，用第三人称小说体描写，保持各角色人设一致，不要跳出角色。',
  );
  lines.push(buildMultiStatusFormatPrompt(npcSchema));

  if (options?.forOpening) {
    lines.push(
      '',
      '## 开场',
      '请立即发送群像开场：以第三人称小说体描写场景与人物，仅相关 NPC 依次或互动发言，用户本人尚未开口。',
    );
  }

  return lines.join('\n');
}

export function buildSessionRoleplayPrompt(
  session: {
    characterId?: string;
    characterIds?: string[];
    userCharacterId?: string;
  } | null | undefined,
  characters: RoleplayCharacter[],
  templates: RoleplayTemplate[],
  options?: { forOpening?: boolean; playerName?: string },
): string | undefined {
  // 调用方通常已传入解析好的 participants；若为空则回退从 session 解析
  let participants = characters;
  if (participants.length === 0) {
    const cast = resolveSessionCast(session);
    if (cast.participantIds.length === 0) return undefined;
    participants = getCharactersByIds(characters, cast.participantIds);
    if (participants.length === 0) return undefined;
  }
  const isMulti = participants.length >= 2;
  if (isMulti) {
    return buildGroupRoleplayPrompt(participants, templates, options);
  }
  const template = getTemplateById(templates, participants[0].templateId);
  return buildCharacterPrompt(participants[0], template, options);
}

export function getRoleplayOpeningMessage(session?: {
  characterId?: string;
  characterIds?: string[];
  userCharacterId?: string;
} | null): string {
  return resolveSessionCast(session).isMulti
    ? ROLEPLAY_GROUP_OPENING_USER_MESSAGE
    : ROLEPLAY_OPENING_USER_MESSAGE;
}

export function getRoleplayStatusRetryMessage(session?: {
  characterId?: string;
  characterIds?: string[];
  userCharacterId?: string;
} | null): string {
  return resolveSessionCast(session).isMulti
    ? ROLEPLAY_GROUP_STATUS_RETRY_MESSAGE
    : ROLEPLAY_STATUS_RETRY_MESSAGE;
}
