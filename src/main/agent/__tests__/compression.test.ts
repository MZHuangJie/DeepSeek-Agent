import { describe, it, expect } from 'vitest';
import { compressToolResult } from '../compression';

describe('compressToolResult', () => {
  it('should not compress short content', () => {
    const short = 'File written: test.ts';
    expect(compressToolResult(short)).toBe(short);
  });

  it('should compress long content', () => {
    const long = 'OK\n' + 'line '.repeat(200);
    const result = compressToolResult(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('[已压缩');
  });

  it('should preserve first line', () => {
    const long = 'First line summary\n' + 'detail '.repeat(200);
    const result = compressToolResult(long);
    expect(result).toContain('First line summary');
  });

  it('should preserve file paths', () => {
    const long = 'Files found:\nsrc/main/tools.ts modified\nsrc/renderer/App.tsx changed\n' + 'x '.repeat(500);
    const result = compressToolResult(long);
    expect(result).toContain('涉及文件');
  });

  it('should preserve last lines with potential errors', () => {
    const long = 'OK\n' + 'data '.repeat(500) + '\nError: something went wrong\nDetails here';
    const result = compressToolResult(long);
    expect(result).toContain('something went wrong');
  });
});
