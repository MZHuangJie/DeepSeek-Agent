import { describe, it, expect } from 'vitest';
import { extractGitUsrBinFromGitExe } from '../shellEnv';

describe('extractGitUsrBinFromGitExe', () => {
  it('should resolve Git for Windows usr/bin', () => {
    const gitExe = 'C:\\Program Files\\Git\\cmd\\git.exe';
    expect(extractGitUsrBinFromGitExe(gitExe)).toBe('C:\\Program Files\\Git\\usr\\bin');
  });

  it('should handle forward slashes', () => {
    const gitExe = 'D:/Tools/Git/cmd/git.exe';
    expect(extractGitUsrBinFromGitExe(gitExe)).toBe('D:\\Tools\\Git\\usr\\bin');
  });

  it('should return null for non Git for Windows layout', () => {
    expect(extractGitUsrBinFromGitExe('C:\\Windows\\System32\\git.exe')).toBeNull();
  });
});
