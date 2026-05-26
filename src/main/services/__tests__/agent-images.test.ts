import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  AGENT_IMAGES_DIR_NAME,
  getAgentImagesDir,
  getPortraitFilePath,
  isAgentImagesPath,
  resolveAgentImageReadPath,
  toDisplayPath,
} from '../agent-images';

describe('agent-images', () => {
  const projectDir = 'D:/MyCLI';

  it('uses .deepseek-agent-images under project root', () => {
    expect(getAgentImagesDir(projectDir)).toContain(`${AGENT_IMAGES_DIR_NAME}`);
    expect(getAgentImagesDir(projectDir)).toBe(path.join(projectDir, AGENT_IMAGES_DIR_NAME));
  });

  it('stores portraits with portrait- prefix in agent images dir', () => {
    const file = getPortraitFilePath(projectDir, 'char-1', '.png');
    expect(file).toContain(`${AGENT_IMAGES_DIR_NAME}${path.sep}portrait-char-1.png`);
  });

  it('validates paths inside agent images directory', () => {
    const imagesDir = getAgentImagesDir(projectDir);
    const file = path.join(imagesDir, 'portrait-char-1.png');
    expect(isAgentImagesPath(file, projectDir)).toBe(true);
    expect(resolveAgentImageReadPath(file, projectDir)).toBe(path.resolve(file));
    expect(isAgentImagesPath('D:/Other/img.png', projectDir)).toBe(false);
    expect(() => resolveAgentImageReadPath('D:/Other/img.png', projectDir)).toThrow('图片路径无效');
  });

  it('normalizes display paths to forward slashes', () => {
    expect(toDisplayPath('D:\\MyCLI\\.deepseek-agent-images\\a.png')).toBe(
      'D:/MyCLI/.deepseek-agent-images/a.png',
    );
  });
});
