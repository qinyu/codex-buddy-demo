# C# / WPF：测试基建事例

识别到 `*.sln`、`*.csproj`、`*.cs` 或 `*.xaml` 时加载本文件。

先读仓库里已有的 SDK、`TargetFramework`、测试包（xUnit / NUnit / MSTest）和覆盖率工具。下面的命令是事例，不是要迁过去的清单。

## 完成标准

- 沿用现有 `dotnet` SDK 和测试框架版本，只增加能跑的检查。
- Windows 原生输出 `init_test_env.ps1`，交给用户跑。
- 成功：有测试结果文件，以及 Cobertura / Coverlet 的 `coverage.xml`（或项目已有的报告路径）。
- WPF：单测 ViewModel、转换器、业务逻辑；不要为了覆盖率去测 XAML 生成代码或 UI 线程。

## 事例（仅当项目还没有等价命令时参考）

已有 xUnit 时：

```powershell
dotnet test --no-restore
```

需要 XML 报告且项目已有 Coverlet 时，沿用 csproj 里的参数。常见写法（不要因此升级包版本）：

```powershell
dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults
```

Coverlet 可以直接出 Cobertura，不必走 JaCoCo 转换。

## WPF 注意

- 特征：`UseWPF`、`*.xaml`、`Window` / `UserControl`。
- 测试项目引用业务项目，不引用仅设计器使用的程序集。
- 装不上依赖或覆盖率不够就停，列出缺什么，交给用户。
