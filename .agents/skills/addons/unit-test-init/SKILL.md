---
version: 0.9.3
name: unit-test-init
metadata:
  version: "0.8.1"
  suite-id: "unit-test"
description: "Use when the user names unit-test-init, 初始化测试, or 添加单测环境; or when kickoff/develop finds no unit-test command for this package. Writes init scripts only; does not keep rerunning tests to chase coverage."
compatibility:
  required_tools: ["bash", "read", "write"]
  runtime:
    node: ">=22"
    python3: "3"
---

# 单元测试环境初始化 (unit-test-init)
## 和外挂 / 工作流怎么互找

本 skill 是独立分包 `unit-test`。工作流用 `$unit-test-init` 触发，不要按同仓相对路径去找。`unit-test-generator` 发现项目缺少测试基础设施时，应先请本 skill 生成配置和可执行验证脚本，然后由用户手动执行验证。

脚本后缀由执行环境决定，**禁止默认只出 Linux `.sh`**：Windows 原生生成 `init_test_env.ps1`，Git Bash / WSL / macOS / Linux 才生成 `init_test_env.sh`。细则见 `references/windows-scripts.md`。

本 Skill 负责为项目引导并搭建测试基础设施，使其能够产出下游工具（如覆盖率检查和 CI）依赖的两个核心产物：

- **`junit.xml`** 或 **多个 `TEST-*.xml`** — JUnit XML 格式的测试结果（供 CI 流水线和测试报告工具消费）。
- **`reports/coverage.xml`**（每个模块下）— Cobertura XML 格式的覆盖率数据（供覆盖率检查工具消费）。单模块项目输出到 `./reports/coverage.xml`，多模块项目输出到 `<module>/reports/coverage.xml`。

## 资源目录

- `assets/prompts/init.prompt`：初始化测试基建时使用的执行提示词。
- `assets/prompts/review.prompt`：审查现有测试基建缺口时使用的提示词。
- `assets/prompts/repair.prompt`：用户手动执行验证脚本失败后，做最小修复时使用的提示词。
- `assets/scripts/jacoco2cobertura.py`：将 JaCoCo / Kover XML 转换为 Cobertura XML 的零依赖脚本。
- `assets/scripts/init_test_env.ps1.example`：Windows 原生脚本包装示例。
- `references/windows-scripts.md`：生成/修复脚本前必读。

在明确识别出技术栈之前，绝对不要安装任何东西或修改任何配置。请遵循下方的决策树，然后加载对应的参考文件获取具体的命令和配置片段。

---

## 步骤 1：识别技术栈与模块

扫描整个项目（包括子目录）以映射所有存在的模块及其技术栈。**绝对不要在匹配到第一个后就停止**——现代项目通常是 monorepo 或多技术栈架构（例如 Python 后端 + Swift iOS App）。

| 特征文件 | 技术栈 | 加载文件 |
|---|---|---|
| `requirements.txt`, `pyproject.toml`, `setup.py`, `setup.cfg` | Python | `references/python.md` |
| `*.xcodeproj`, `*.xcworkspace`, `Package.swift`, `Podfile` | iOS / Swift | `references/ios.md` |
| `pom.xml`, `build.gradle`, `build.gradle.kts` | Java | `references/jvm/java.md` |
| 存在 `.kt` 文件且无 `pom.xml` | Kotlin | `references/jvm/kotlin.md` |
| `go.mod`, `go.work` | Go | `references/go.md` |
| `tsconfig.json` | TypeScript | `references/frontend/typescript.md` |
| `package.json`（检查 `dependencies`，跳过 Flutter / React Native） | JavaScript | `references/frontend/javascript.md` |
| `pubspec.yaml` | Flutter / Dart | `references/flutter.md` |
| `*.sln`、`*.csproj`、`*.cs`、`*.xaml` | C# / WPF | `references/csharp.md` |

### Monorepo / 多语言混合架构的子代理分发
如果检测到多个模块/技术栈：
1. 按照技术栈对目标模块进行分组。
2. **派生子代理** 处理每一个模块。
3. 对于每个子代理，请**仅提供**对应模块的路径，并严格指示它**只能**加载与其匹配的 `references/*.md` 文件。
4. 等待所有子代理完成初始化任务后，再汇总全局的项目状态。

如果没有匹配到任何特征文件，请在继续之前询问用户。

识别栈之后、改配置之前，读 `references/add-not-upgrade.md`。完成标准：沿用现有 JDK / 包管理器 / 测试框架版本，只增加能跑的检查。

---

## 步骤 2：读取参考文件

识别出技术栈后，读取 `references/` 目录下的对应文件。里面的 Maven / JUnit / Jest 等命令是事例，不是要迁过去的清单；沿用仓库里已有的构建和测试工具。

**示例泛化纪律（写任何配置/脚本前自查）**：规则主语必须是类别名词——「语言 SDK 与运行时、包管理器、框架、依赖、构建脚本与 wrapper 一律沿用仓库现有版本，只增不改」；具体工具名（Maven/Jest/JaCoCo…）只以示例身份出现，不穷尽。看到参考文件里的具体版本号（如 jacoco 0.8.11）或包名（如 jest 四件套）时，一律替换为项目现有版本与等价物；不得字面照搬。

**在写任何 `init_test_env.*` 之前**，再读 `references/windows-scripts.md`。技术栈文件里的 bash 模板只是命令清单；包装成 `.ps1` 还是 `.sh` 以 windows-scripts 为准。

---

## 步骤 3：输出执行脚本（区分执行模式）

### 零配置变更模式（默认优先）

生成脚本前先判断：能否**不动构建文件**就产出 junit.xml 和 reports/coverage.xml？能则优先零配置：

- Maven：命令行直接跑 JaCoCo goal（`mvn test jacoco:report` 类命令，带 `-pl` 时只限变更模块），不往 pom.xml 加插件。
- Gradle：优先已有任务；没有时用 init script（`--init-script` 临时注入）而非改 build.gradle。
- npm/npx：依赖用 `npx` 直跑或 `npm --no-save` 安装，不改 package.json；coverage 用配置文件 CLI 参数传入（如 `npx jest --coverage --coverageReporters=cobertura` 或 `npx vitest run --coverage`），不往 package.json 加 script 和 devDependencies。
- Python：`pytest --cov --cov-report=xml` 命令行参数直跑，不动 pyproject/pytest.ini。

只有命令行拿不到所需报表（如 JaCoCo 版本过老不支持命令行 goal、项目自定义了 report 路径）时，才写构建文件；**写之前必须先出 diff**（改哪个文件、加哪几行）请用户批准，批准后才能落盘，并把 diff 记入产物。同类构建工具（language SDK、包管理器、构建脚本与 wrapper）一律同一原则，不限于上述示例。

### 执行模式

默认按**客户现场模式**处理：🚫 **严禁自动执行任何构建或测试命令**（`cmake`、`make`、`mvn`、`gradle`、`pytest`、`xcodebuild`、`go test` 等）。
> 构建命令可能触发网络下载（例如 Maven / Gradle 拉取依赖），在受限网络环境下可能长时间挂起，导致整个流程卡住。

完成文件生成和配置变更后，按 `references/windows-scripts.md` 输出**一份**验证脚本（`.ps1` 或 `.sh`），包含完整的构建 → 测试 → 报告流程。脚本完成标准不仅是“写出命令”：必须将每个报告的**生成入口、实际输出路径、归一化/转换步骤和非空检查**串成可执行链；不能把“建议安装/以后执行”当作已生成报告。然后**把执行权交还给用户**，用以下格式告知（命令随实际文件改）：

```
✅ 配置文件已生成。请在终端手动执行以下命令以验证环境：

  powershell -NoProfile -File .\init_test_env.ps1
  # 或：bash init_test_env.sh

成功标准：
  1. 出现 junit.xml 或 TEST-*.xml
  2. 出现 reports/coverage.xml（非空）

如有报错，请将错误信息粘贴给我，我来分析修复。
```

用户明确要求跳过本次手动验证、先写业务代码时：允许继续，但必须在 `develop.md` 与 `.workflow-state.json` 记录豁免；不得把未跑通的基建标成已通过。

**禁止自动重试**：用户反馈脚本报错后，读取错误信息、修改配置文件、再次输出修正版脚本，由用户再次手动执行。严禁进入"执行 → 失败 → 修改 → 再执行"的自动循环。

### Eval 沙箱模式

只有当用户明确说明这是独立、干净、可丢弃的验证目录（例如 `evals/room/`、`workshop-validation/` 或 clean-room copy），并要求你执行验证时，才可以运行生成的脚本或等价测试命令。此时必须：

1. 先确认当前路径不是主工作区或用户真实业务仓库。
2. 记录执行命令、退出码、关键输出和断言结果。
3. 失败后只做最小修复并重新执行有限次数；把每次失败原因写入验证记录。
4. 不把 eval 沙箱产生的 `reports/`、`logs/`、`room/` 产物打包进 skill 发布物。

---

## 与其他 Skill 的关联

- 当项目完全没有测试基础设施时，**优先运行此 Skill**。
- 在此 Skill 完成后，运行 **`unit-test-generator`** 来编写实际的测试用例。
- 最后，根据项目需要配置基于这些 XML 文件的本地钩子、CI 检查或覆盖率检查工具。

注意：此 Skill 仅负责搭建工具链，它不负责编写具体的业务测试用例。
