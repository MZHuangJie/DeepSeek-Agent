import { describe, it, expect, beforeEach } from 'vitest';

// 直接测试 buildCharacterDescription 和 roleplay-storage 中的纯函数
import {
  buildCharacterDescription,
  buildCharacterDescription as buildDesc,
} from '../roleplay-portrait';
import type { PortraitCharacterInput } from '../roleplay-portrait';

describe('buildCharacterDescription', () => {
  it('includes basic fields', () => {
    const input: PortraitCharacterInput = {
      name: '测试角色',
      gender: '女',
      occupation: '刺客',
    };
    const desc = buildCharacterDescription(input);
    expect(desc).toContain('姓名：测试角色');
    expect(desc).toContain('性别：女');
    expect(desc).toContain('职业：刺客');
  });

  it('omits empty optional fields', () => {
    const input: PortraitCharacterInput = { name: '测试角色' };
    const desc = buildCharacterDescription(input);
    expect(desc).not.toContain('性别');
    expect(desc).not.toContain('职业');
  });

  it('includes body measurements when provided', () => {
    const input: PortraitCharacterInput = {
      name: '测试角色',
      body: { height: '170cm', hair: '黑长直', eyes: '琥珀色' },
    };
    const desc = buildCharacterDescription(input);
    expect(desc).toContain('身高：170cm');
    expect(desc).toContain('发型/发色：黑长直');
    expect(desc).toContain('眼睛：琥珀色');
  });

  it('does not include empty body fields', () => {
    const input: PortraitCharacterInput = {
      name: '测试角色',
      body: { height: '170cm' },
    };
    const desc = buildCharacterDescription(input);
    expect(desc).toContain('身高：170cm');
    expect(desc).not.toContain('体重');
  });

  it('includes personality and background', () => {
    const input: PortraitCharacterInput = {
      name: '测试角色',
      personality: '冷静、果断',
      background: '出身于暗杀组织',
    };
    const desc = buildCharacterDescription(input);
    expect(desc).toContain('性格：冷静、果断');
    expect(desc).toContain('故事背景：出身于暗杀组织');
  });
});
