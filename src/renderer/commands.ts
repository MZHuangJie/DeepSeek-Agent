export interface Command {
  name: string;           // 如 'create-skills'
  description: string;    // 简短描述
  detail: string;         // 详细说明
  systemPrompt: string;   // 注入到 system prompt 的额外指令
}

export const COMMANDS: Command[] = [
  {
    name: 'plugin',
    description: '打开插件管理器',
    detail: '浏览、安装和管理插件（skills），扩展AI能力',
    systemPrompt: '',
  },
  {
    name: 'create-skills',
    description: '分析代码模式，生成 SKILL.md',
    detail: '分析项目 git 历史和代码模式，提取可复用的编码模式并生成 SKILL.md 技能文件',
    systemPrompt: `你正在执行 /create-skills 命令。请：
1. 分析项目的代码结构和编码模式
2. 识别可复用的 patterns、conventions 和 best practices
3. 生成适合本项目的 SKILL.md 文件内容
4. 如果项目有 git 历史，参考提交记录了解代码演变`,
  },
  {
    name: 'plan',
    description: '制定分步实施计划',
    detail: '分析需求，评估风险，创建分步实施计划，识别依赖和关键文件',
    systemPrompt: `你正在执行 /plan 命令。请：
1. 深入理解用户的需求
2. 分析现有代码库的相关部分
3. 评估实现方案和风险
4. 制定分步骤的实施计划
5. 识别关键文件、依赖关系和潜在冲突
6. 给出每个步骤的预估工作量`,
  },
  {
    name: 'review',
    description: '代码审查',
    detail: '审查代码质量、安全性、可维护性，查找潜在 bug',
    systemPrompt: `你正在执行 /review 命令。请对代码进行全面审查：
1. 安全性检查：命令注入、路径穿越、XSS、SQL注入、密钥泄露
2. 代码质量：命名规范、函数长度、文件组织、错误处理
3. 可维护性：重复代码、耦合度、抽象层次
4. 性能问题：N+1查询、内存泄漏、不必要的计算
5. 按严重级别分类问题：CRITICAL > HIGH > MEDIUM > LOW`,
  },
  {
    name: 'fix',
    description: '修复构建或类型错误',
    detail: '诊断构建错误、类型错误、lint 警告并修复',
    systemPrompt: `你正在执行 /fix 命令。请：
1. 先运行构建命令查看错误
2. 逐个分析错误原因
3. 以最小改动修复每个错误
4. 修复后验证构建通过
5. 不要引入不必要的重构或改动`,
  },
  {
    name: 'test',
    description: '编写测试用例',
    detail: '为指定模块编写单元测试和集成测试，目标覆盖率 80%+',
    systemPrompt: `你正在执行 /test 命令。请：
1. 先分析需要测试的模块
2. 使用 AAA 模式（Arrange-Act-Assert）编写测试
3. 覆盖正常路径、边界条件和错误情况
4. 目标测试覆盖率 80%+
5. 如果已有测试框架，遵循现有模式`,
  },
  {
    name: 'refactor',
    description: '清理和重构代码',
    detail: '识别死代码、重复代码，进行安全清理和重构',
    systemPrompt: `你正在执行 /refactor 命令。请：
1. 先全面了解代码结构
2. 识别死代码、未使用的导入/变量/函数
3. 识别重复代码可以抽取的部分
4. 逐个文件进行清理，每次改动后验证
5. 遵循不可变性原则和项目现有的编码风格`,
  },
  {
    name: 'security',
    description: '安全审计',
    detail: '专项安全漏洞扫描和修复建议',
    systemPrompt: `你正在执行 /security 命令。请进行专项安全审计：
1. 检查所有用户输入处理路径
2. 检查命令执行、文件操作的注入风险
3. 检查认证、授权逻辑
4. 检查密钥和敏感数据管理
5. 检查第三方依赖的已知漏洞
6. 按 OWASP Top 10 逐项审查
7. 每个发现标注严重级别和修复方案`,
  },
  {
    name: 'docs',
    description: '生成或更新文档',
    detail: '分析代码生成 API 文档、README 或代码注释',
    systemPrompt: `你正在执行 /docs 命令。请：
1. 分析项目结构和关键模块
2. 为缺少文档的 API/函数生成文档
3. 更新 README.md 以反映当前项目状态
4. 生成架构概览文档
5. 遵循项目现有的文档风格`,
  },
];

export function matchCommand(input: string, dynamicCommands?: Command[]): Command | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const spaceIndex = trimmed.indexOf(' ');
  const cmdName = (spaceIndex > 0 ? trimmed.slice(1, spaceIndex) : trimmed.slice(1)).toLowerCase();
  const allCommands = [...COMMANDS, ...(dynamicCommands || [])];
  return allCommands.find(c => c.name === cmdName) ?? null;
}

export function getCommandList(dynamicCommands?: Command[]): string {
  const allCommands = [...COMMANDS, ...(dynamicCommands || [])];
  return allCommands.map(c => `/${c.name} - ${c.description}`).join('\n');
}
