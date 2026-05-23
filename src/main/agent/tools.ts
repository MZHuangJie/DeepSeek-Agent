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
import { getExtraTools } from './tools-extras';

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
    ...getExtraTools(projectDir),
  ];
}

export function getToolSchemas(tools: ToolDef[]) {
  return tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}
