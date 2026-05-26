import path from 'path';
import { glob } from 'glob';
import { SubAgentTask, SubAgentType } from './sub-agent';
import { safeResolve } from './tools/security';

export interface DecompositionStrategy {
  shouldDecompose: boolean;
  reason: string;
  tasks: SubAgentTask[];
}

export class TaskDecomposer {
  /**
   * 判断是否需要分解任务，并生成子任务列表
   */
  async analyzeAndDecompose(
    projectDir: string,
    userQuery: string
  ): Promise<DecompositionStrategy> {
    // 扫描项目文件
    const allSourceFiles = await glob('**/*.{ts,tsx,js,jsx,json,md}', {
      cwd: projectDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
      absolute: false,
    });

    const totalFiles = allSourceFiles.length;

    // 判断是否需要分解
    const needsDecomposition = this.shouldDecomposeTask(totalFiles, userQuery);

    if (!needsDecomposition.shouldDecompose) {
      return {
        shouldDecompose: false,
        reason: needsDecomposition.reason,
        tasks: [],
      };
    }

    // 按目录分组文件
    const filesByDirectory = this.groupFilesByDirectory(allSourceFiles);

    // 生成子任务
    const tasks = this.generateSubTasks(filesByDirectory, projectDir, userQuery);

    return {
      shouldDecompose: true,
      reason: needsDecomposition.reason,
      tasks,
    };
  }

  /**
   * 判断是否需要分解任务
   */
  private shouldDecomposeTask(
    totalFiles: number,
    userQuery: string
  ): { shouldDecompose: boolean; reason: string } {
    // 规则1：文件数量超过50个，且用户要求查看/分析/审计项目
    const isExplorationQuery =
      /查看|分析|审计|了解|review|analyze|explore|audit/i.test(userQuery);

    if (totalFiles > 50 && isExplorationQuery) {
      return {
        shouldDecompose: true,
        reason: `项目包含 ${totalFiles} 个文件，超过单代理处理阈值（50），将使用子代理并行探索`,
      };
    }

    // 规则2：文件数量超过100个，无论查询内容
    if (totalFiles > 100) {
      return {
        shouldDecompose: true,
        reason: `项目包含 ${totalFiles} 个文件，规模较大，将使用子代理并行处理`,
      };
    }

    return {
      shouldDecompose: false,
      reason: `项目包含 ${totalFiles} 个文件，单代理可以处理`,
    };
  }

  /**
   * 按目录分组文件
   */
  private groupFilesByDirectory(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const file of files) {
      const dir = path.dirname(file);
      const topLevelDir = this.getTopLevelDirectory(dir);

      if (!groups.has(topLevelDir)) {
        groups.set(topLevelDir, []);
      }
      groups.get(topLevelDir)!.push(file);
    }

    return groups;
  }

  /**
   * 获取顶级目录（如 src/main/agent -> src）
   */
  private getTopLevelDirectory(dir: string): string {
    const parts = dir.split(/[/\\]/);
    if (parts.length === 0 || parts[0] === '.') {
      return '.';
    }
    return parts[0];
  }

  /**
   * 生成子任务列表
   */
  private generateSubTasks(
    filesByDirectory: Map<string, string[]>,
    projectDir: string,
    userQuery: string
  ): SubAgentTask[] {
    const tasks: SubAgentTask[] = [];

    // 按目录大小排序，优先处理大目录
    const sortedDirs = Array.from(filesByDirectory.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );

    // 为每个主要目录创建一个探索任务
    for (const [dir, files] of sortedDirs) {
      // 跳过小目录（文件数 < 5）
      if (files.length < 5) continue;

      const taskId = `explore-${dir}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const absDir = safeResolve(projectDir, dir);
      tasks.push({
        id: taskId,
        type: 'explore' as SubAgentType,
        description: this.buildExploreDescription(absDir, files, userQuery),
        targetPath: absDir,
        projectDir,
      });
    }

    // 如果没有生成任何任务（所有目录都太小），创建一个全局探索任务
    if (tasks.length === 0) {
      const taskId = `explore-all-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      tasks.push({
        id: taskId,
        type: 'explore' as SubAgentType,
        description: `探索整个项目的代码结构和功能。用户查询：${userQuery}`,
        targetPath: safeResolve(projectDir, '.'),
        projectDir,
      });
    }

    return tasks;
  }

  /**
   * 构建探索任务的描述
   */
  private buildExploreDescription(
    dir: string,
    files: string[],
    userQuery: string
  ): string {
    const fileCount = files.length;
    const fileTypes = this.analyzeFileTypes(files);

    let description = `探索 ${dir}/ 目录（包含 ${fileCount} 个文件）。\n\n`;
    description += `**文件类型分布**：\n`;
    for (const [ext, count] of Object.entries(fileTypes)) {
      description += `- ${ext}: ${count} 个文件\n`;
    }
    description += `\n**任务要求**：\n`;
    description += `1. 使用 list_files 列出 ${dir}/ 目录的内容\n`;
    description += `2. 使用 read_file 读取所有源代码文件\n`;
    description += `3. 理解每个文件的功能和作用\n`;
    description += `4. 识别关键的类、函数和模块\n`;
    description += `5. 给出结构化的总结\n\n`;
    description += `**用户原始查询**：${userQuery}\n`;

    return description;
  }

  /**
   * 分析文件类型分布
   */
  private analyzeFileTypes(files: string[]): Record<string, number> {
    const types: Record<string, number> = {};

    for (const file of files) {
      const ext = path.extname(file) || '(无扩展名)';
      types[ext] = (types[ext] || 0) + 1;
    }

    return types;
  }

  /**
   * 为特定的分析任务生成子任务
   */
  generateAnalysisTasks(
    targetFiles: string[],
    projectDir: string,
    analysisGoal: string
  ): SubAgentTask[] {
    const tasks: SubAgentTask[] = [];

    // 将文件分组，每组最多10个文件
    const batchSize = 10;
    for (let i = 0; i < targetFiles.length; i += batchSize) {
      const batch = targetFiles.slice(i, i + batchSize);
      const taskId = `analyze-batch-${i / batchSize}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      tasks.push({
        id: taskId,
        type: 'analyze' as SubAgentType,
        description: `分析以下文件：\n${batch.map((f) => `- ${f}`).join('\n')}\n\n分析目标：${analysisGoal}`,
        targetPath: safeResolve(projectDir, path.dirname(batch[0])),
        projectDir,
      });
    }

    return tasks;
  }

  /**
   * 为代码审查生成子任务
   */
  generateReviewTasks(
    targetFiles: string[],
    projectDir: string,
    reviewFocus: string
  ): SubAgentTask[] {
    const tasks: SubAgentTask[] = [];

    // 按文件类型分组
    const filesByType = new Map<string, string[]>();
    for (const file of targetFiles) {
      const ext = path.extname(file);
      if (!filesByType.has(ext)) {
        filesByType.set(ext, []);
      }
      filesByType.get(ext)!.push(file);
    }

    // 为每种文件类型创建一个审查任务
    for (const [ext, files] of filesByType) {
      const taskId = `review-${ext}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      tasks.push({
        id: taskId,
        type: 'review' as SubAgentType,
        description: `审查以下 ${ext} 文件：\n${files.map((f) => `- ${f}`).join('\n')}\n\n审查重点：${reviewFocus}`,
        targetPath: safeResolve(projectDir, path.dirname(files[0])),
        projectDir,
      });
    }

    return tasks;
  }
}
