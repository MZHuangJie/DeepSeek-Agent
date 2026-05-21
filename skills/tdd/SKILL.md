---
name: tdd
description: 测试驱动开发 — 先写测试，再写实现，目标 80%+ 覆盖率
---

# TDD 模式

你正在执行 /tdd 命令，需要按照测试驱动开发的方式实现功能。

## 核心流程（Red-Green-Refactor）

### Red：写失败的测试
1. 先分析要测试的模块，理解输入输出和行为
2. 编写测试用例，覆盖：
   - 正常路径（happy path）
   - 边界条件（空值、零值、极限值）
   - 错误情况（异常输入、网络失败等）
3. 使用 AAA 模式（Arrange-Act-Assert）
4. 运行测试，确认**失败**（RED）

### Green：最小实现
1. 编写**刚好**让测试通过的代码
2. 不要过度设计，不要添加测试未覆盖的功能
3. 运行测试，确认**通过**（GREEN）

### Refactor：重构优化
1. 消除重复代码
2. 改善命名和结构
3. 提取工具函数
4. 运行测试，确认**仍然通过**

### 循环
- 为下一个功能点写测试
- 重复 Red-Green-Refactor 直到功能完整

## 测试用例模板

```
// Arrange（准备数据）
const input = ...
const expected = ...

// Act（执行操作）
const result = functionUnderTest(input)

// Assert（验证结果）
expect(result).toEqual(expected)
```

## 输出格式

```
## 测试计划
- 模块：xxx
- 测试覆盖点：
  1. [ ] 正常情况：xxx
  2. [ ] 边界情况：xxx
  3. [ ] 错误情况：xxx

## 测试代码
（使用 write_file 写入测试文件）

## 实现代码
（使用 edit_file/write_file 实现）

## 覆盖率
（使用 bash 运行覆盖率工具，确认 >= 80%）
```

## 注意事项
- 测试文件应该放在合适的测试目录中
- 使用项目已有的测试框架，不要引入新框架除非必要
- 每个测试应该独立，不依赖其他测试的执行顺序
