import { describe, it, expect } from 'vitest';
import {
  normalizeStatusFields,
  resolveStatusValue,
  createCustomStatusField,
  DEFAULT_STATUS_FIELDS,
  buildCharacterStatusEnabledMap,
  getEffectiveStatusFields,
  getTemplateStatusFieldDefs,
} from '../roleplay';
import type { RoleplayCharacter, RoleplayTemplate } from '../roleplay';

describe('status fields', () => {
  it('uses label as json key after normalize', () => {
    const fields = normalizeStatusFields([
      createCustomStatusField('好感度'),
    ]);
    expect(fields[0].key).toBe('好感度');
  });

  it('dedupes duplicate labels', () => {
    const fields = normalizeStatusFields([
      createCustomStatusField('好感度'),
      createCustomStatusField('好感度'),
    ]);
    expect(fields[0].key).toBe('好感度');
    expect(fields[1].key).toBe('好感度_2');
  });

  it('resolves legacy english keys', () => {
    const field = DEFAULT_STATUS_FIELDS.find(f => f.label === '情绪')!;
    expect(resolveStatusValue({ mood: '害羞' }, field)).toBe('害羞');
  });

  it('merges template schema with character enabled map', () => {
    const template: RoleplayTemplate = {
      id: 'tpl-test',
      name: '测试',
      statusFields: [
        { key: '情绪', label: '情绪', type: 'text', section: 'state', enabled: true },
        { key: '心率', label: '心率', type: 'number', section: 'state', enabled: true },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const character: RoleplayCharacter = {
      id: 'char-1',
      templateId: 'tpl-test',
      name: 'A',
      statusFieldEnabled: { 情绪: true, 心率: false },
      createdAt: 0,
      updatedAt: 0,
    };
    const enabled = buildCharacterStatusEnabledMap(character, template);
    expect(enabled['心率']).toBe(false);
    const effective = getEffectiveStatusFields(character, template);
    expect(effective.map(f => f.label)).toEqual(['情绪']);
  });

  it('falls back to default fields when template has none', () => {
    const template: RoleplayTemplate = {
      id: 'tpl-empty',
      name: '空',
      createdAt: 0,
      updatedAt: 0,
    };
    expect(getTemplateStatusFieldDefs(template).length).toBe(DEFAULT_STATUS_FIELDS.length);
  });
});
