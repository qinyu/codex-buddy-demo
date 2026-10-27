---
version: 0.9.3
name: unit-test-generator
metadata:
  version: "0.8.1"
  suite-id: "unit-test"
description: "Use when the user names unit-test-generator, or asks to write/fix unit tests for named files in a product-workflow slice. Not for installing test tooling (that is unit-test-init)."
compatibility:
  required_tools: ["bash", "read", "write", "edit"]
  runtime:
    node: ">=22"
    python3: "3"
---

# 单元测试实施规范 (AI 辅助单元测试标准 v1.0)
## 和外挂 / 工作流怎么互找

本 skill 是独立分包 `unit-test`。工作流用 `$unit-test-generator` 触发，不要按同仓相对路径去找。`$product:kickoff`、`$product:develop` 和 `$product:test-cases` 需要写/修单测时请本 skill。缺测试基建时先 `$unit-test-init`。

## 概述

此 Skill 负责执行 AI 辅助单元测试标准 v1.0 中定义的高质量单元测试规范。每个测试都必须具备高可读性、完全隔离且有意义。此规则适用于任何语言和框架。

**职责划分:**
- **本 Skill**：专门负责按照统一测试规范编写和审查测试代码。
- **覆盖率检查工具（如有）**：负责设置本地或 CI 检查，拦截测试失败和团队覆盖率阈值不足的提交。检查工具配置不在本 Skill 的职责范围内。

---

## 技术栈探测与调度

在采取任何操作之前，请先确定作用域。扫描项目（包括子目录）以映射所有模块及其技术栈。**绝对不要在匹配到第一个特征后就停止**——因为现代项目通常是 monorepo 或多语言混合架构，如果不遍历整个项目，可能会遗漏某些代码栈的测试与配置。

| 特征文件 | 技术栈 | 加载文件 |
|---|---|---|
| `requirements.txt`, `pyproject.toml`, `setup.py`, `setup.cfg` | Python | `references/python.md` |
| `*.xcodeproj`, `*.xcworkspace`, `Package.swift`, `Podfile` | iOS / Swift | `references/ios.md` |
| `pom.xml`, `build.gradle`, `build.gradle.kts` | Java | `references/jvm/java.md` |
| 存在 `.kt` 文件且无 `pom.xml` | Kotlin | `references/jvm/kotlin.md` |
| `go.mod`, `go.work` | Go | `references/go.md` |
| `tsconfig.json` | TypeScript | `references/frontend/typescript.md` |
| `package.json`（且无 TypeScript / Flutter 特征） | JavaScript | `references/frontend/javascript.md` |
| `pubspec.yaml` | Flutter / Dart | `references/flutter.md` |
| `*.sln`、`*.csproj`、`*.cs`、`*.xaml` | C# / WPF | `references/csharp.md` |

### Monorepo / 多语言混合架构的子代理分发
当需要跨越不同技术栈的多个文件或模块生成或审查测试时：
1. **基于文件后缀确定目标技术栈**：在生成测试时，绝对不要依赖根目录配置（如 `package.json`）。你**必须**查看目标文件的扩展名：
   - `.swift` -> iOS -> 加载 `references/ios.md`
   - `.py` -> Python -> 加载 `references/python.md`
   - `.ts` / `.tsx` -> TypeScript -> 加载 `references/frontend/typescript.md`
   - `.js` / `.jsx` -> JavaScript -> 加载 `references/frontend/javascript.md`
   - `.java` -> Java -> 加载 `references/jvm/java.md`
   - `.kt` -> Kotlin -> 加载 `references/jvm/kotlin.md`
   - `.go` -> Go -> 加载 `references/go.md`
   - `.dart` -> Flutter / Dart -> 加载 `references/flutter.md`
   - `.cs` / `.xaml` -> C# / WPF -> 加载 `references/csharp.md`
2. **派生子代理**：为每一个目标模块或语言分组派生一个独立的子代理。
3. **严格的上下文注入**：请**只将**对应的 `references/*.md` 文件注入该子代理的上下文中。**这能有效防止知识污染，因为大模型如果同时阅读了多份语言规约，极易混淆语法（比如把 Jest 风格误写进 Python 或 Java 测试里）。**
4. **结果聚合**：等待所有子代理完成任务并汇总生成的测试文件。

**规则**：子代理**必须**阅读加载的参考文件以获取对应语言的实现细节（如框架、AAA 结构、参数化测试、异步处理等）。严禁单纯依赖大模型的通用知识。

| 用户的意图... | 使用模式 |
|---|---|
| 评估项目的测试健康度 | 模式 0: 项目状态诊断 |
| 为新代码或已有代码生成测试 | 模式 1: 生成测试 |
| 审查现有测试并自动修复 | 模式 2: 审查与自动修复 |
| 用户批准后、为可测试性改本切片碰到的代码 | 模式 3: 可测试性重构 |

---

## 模式 0: 项目状态诊断（必须第一步执行）

> 在选择任何模式之前，必须先阅读并执行
> `references/mode0-diagnosis.md` 中的完整诊断流程，判断项目属于哪种状态，
> 再决定采用模式 1 / 2 / 3 中的哪种策略。

---

## 核心测试理论与规范

> 完整的 FIRST 原则、Mock 策略、命名规范、AAA 结构、参数化测试、反模式、
> Quick Reference 和 Common Mistakes 见
> `references/testing-principles.md`。

---

## 三种模式

### 模式 1：生成测试

> ⚠️ **前置条件:** 先完成模式 0。遗留套件里碰到不可测代码时，按诊断树列出可测试性挑战，不要静默转入模式 3。新增代码必须可测；优先抽出。

用于为任何代码编写新测试。Agent 将根据代码特征（文件后缀等）自动识别并加载对应框架的参考文件。请遵循统一测试规范，包括针对边界和异常输入的参数化测试。

**执行指令**: 请读取并使用 `assets/prompts/generate.prompt` 作为你的系统提示词。

---

### 模式 2：审查与自动修复

用于审查现有测试是否符合统一测试规范。Agent 将生成一份结构化的违规报告，并紧接着输出完全重构后的、符合规范的测试代码。

**执行指令**: 请读取并使用 `assets/prompts/review.prompt` 作为你的系统提示词。报告应保存至 `skill-output/unit-testing/`。

---

### 模式 3：可测试性重构

仅当用户明确批准、且范围限于本切片碰到的代码时使用。遗留套件默认不走这里：先抽出或窄排除。健康套件仍可走方案 A。

**执行指令**: 请读取并使用 `assets/prompts/refactor.prompt` 作为你的系统提示词。重构计划应保存至 `skill-output/unit-testing/`。

用户确认应用后，进入模式 1，只给现在可测的单元写测试。不要重写整个类。

### 抽出（默认允许）

新行为写在可测的新函数或新类型里，旧代码只加一行调用。给新单元写测试。外包、改构造、改注入必须用户批准。

### 方案 B：覆盖率豁免（排除不可测的遗留行）

用户未批准改结构时，对不可测的遗留行走最窄排除，然后进入模式 1 测试其余代码和全部新增代码。不要静默排除：先写入可测试性挑战清单（推荐 + 依据），用户点头或一批确认后再落排除。

**豁免粒度选择原则（从细到粗，能细则细）：**

| 粒度 | 适用场景 | 示例 |
|------|---------|------|
| **行级** | 单行不可测（如日志、资源释放） | `# pragma: no cover` / `// GCOV_EXCL_LINE` |
| **块级** | 连续几行不可测（如异常处理分支） | `# pragma: no cover` 配合 `if False:` / `GCOV_EXCL_START…STOP` |
| **方法级** | 整个方法是框架生命周期回调 | Swift: `// swiftlint:disable:next` + Slather ignore / Kotlin: `@Suppress` |
| **文件级** | 整个文件是生成代码或三方代码 | JaCoCo `<exclude>`, gcovr `--exclude`, Slather `ignore:` |

**必须配套操作：**
1. 在豁免注解或 coverage exclude 配置旁边写明原因，例如：`# pragma: no cover  # AppDelegate lifecycle, no injection point`。Java/Android/Kotlin 等栈必须给出项目覆盖率工具实际识别的**完整注解/配置原文**；只写“可使用某注解”不算完成。
2. 在 `docs/testing/coverage-exemptions.md` 记录一条后续处理记录，写清被排除的代码和期望的后续处理方式；固定使用下方五列：`范围`、`原因`、`替代验证`、`Owner`、`回看时机`。不得把 sandbox 路径替代该项目级记录路径。
3. 不要通过降低覆盖率阈值来规避覆盖不足——只能使用项目覆盖率工具认可的排除机制，并且必须记录豁免原因和替代验证

`docs/testing/coverage-exemptions.md` 固定模板：

```markdown
# Coverage Exemptions

| 范围 | 原因 | 替代验证 | Owner | 回看时机 |
|---|---|---|---|---|
| `path/to/file` | 为什么当前不可测 | 用什么测试/人工验证替代 | @owner | 何时回看 |
```

**各技术栈豁免语法速查：**

```python
# Python — 行级
risky_call()  # pragma: no cover

# Python — 块级
def legacy_path(self):  # pragma: no cover
    ...
```

```swift
// Swift — 文件排除在 .slather.yml 的 ignore: 列表里
// 方法级：暂无标准注解，需在 .slather.yml ignore 中排除含该方法的文件
```

```java
// Java/Kotlin — JaCoCo 文件级排除（pom.xml / build.gradle）
// <exclude>com/example/generated/**</exclude>
```

---

## 生态集成

此 Skill 负责编写和审查测试，但**不会**自动执行覆盖率检查。该职责应由项目已有的本地钩子、CI 配置或覆盖率检查工具承担。

如果由于覆盖率不足而无法通过检查，请使用模式 1 补齐缺失测试后再重新验证。

---
