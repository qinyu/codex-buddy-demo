# C# / WPF

检测信号：`*.sln`、`*.csproj`、`*.cs`、`*.xaml`、`UseWPF`。

常见命令（沿用仓库已有的，不要换 SDK 版本）：
- `dotnet test`
- `dotnet format --verify-no-changes`（仅当项目已经在用）

建议：
- 轻量检查可作为 `pre-commit` 候选。
- `dotnet test` 默认作为 `pre-push` 候选。
- 没有测试命令或报告产物时，标记需要 `unit-test-init`。
