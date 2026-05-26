import type { ToolDef, ToolContext } from './tools/index';
export type { ToolDef, ToolContext };

import { createReadFileTool } from './tools/read-file';
import { createWriteFileTool } from './tools/write-file';
import { createEditFileTool } from './tools/edit-file';
import { createGrepTool } from './tools/grep';
import { createGlobTool } from './tools/glob';
import { createBashTool } from './tools/bash';
import { createListFilesTool } from './tools/list-files';
import { createSpawnSubAgentTool } from './tools/spawn-sub-agent';
import { createAutoDecomposeTaskTool } from './tools/auto-decompose-task';
import { createBrowseUrlTool } from './tools/browse-url';
import { createWebSearchTool } from './tools/web-search';
import { createWebFetchTool } from './tools/web-fetch';
import { createWebScreenshotTool } from './tools/web-screenshot';
import { createPresentWebTool } from './tools/present-web';
import { createPresentChoicesTool } from './tools/present-choices';
import { createGenerateImageTool } from './tools/generate-image';
import { createDescribeImageTool } from './tools/describe-image';

const SUB_AGENT_EXCLUDED_TOOLS = new Set([
  'spawn_sub_agent',
  'auto_decompose_task',
  'bash',
  'generate_image',
  'browse_url',
  'present_web',
  'present_choices',
]);

export function getAllTools(projectDir: string): ToolDef[] {
  return [
    createReadFileTool(projectDir),
    createWriteFileTool(projectDir),
    createEditFileTool(projectDir),
    createGrepTool(projectDir),
    createGlobTool(projectDir),
    createBashTool(projectDir),
    createListFilesTool(projectDir),
    createSpawnSubAgentTool(projectDir),
    createAutoDecomposeTaskTool(projectDir),
    createBrowseUrlTool(),
    createWebSearchTool(),
    createWebFetchTool(),
    createWebScreenshotTool(),
    createPresentWebTool(),
    createPresentChoicesTool(),
    createGenerateImageTool(),
    createDescribeImageTool(),
  ];
}

/** 子代理仅保留读/搜/改文件能力，避免嵌套派生与高风险工具 */
export function getSubAgentTools(projectDir: string): ToolDef[] {
  return getAllTools(projectDir).filter(t => !SUB_AGENT_EXCLUDED_TOOLS.has(t.name));
}

export function getToolSchemas(tools: ToolDef[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
