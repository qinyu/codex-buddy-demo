# WPF UI 切片

识别：`*.csproj` 含 `<UseWPF>true</UseWPF>`，或存在 `.xaml`。先读 TargetFramework、现有 ResourceDictionary、控件样式、MVVM 框架、ViewModel、Converter 和命令绑定；不得把 WPF 改写成 Web UI。

- 原型：用页面/窗口/弹窗与状态说明约束 XAML；沿用现有资源键、布局、控件和 Windows 交互，不发明 Web 导航。
- 实现：优先改 ViewModel、Command、Binding 与资源字典；code-behind 只沿用既有轻量事件模式。字段必须来自模型/契约。
- 测试：单测 ViewModel、命令、转换器和业务逻辑；UI 线程/生成 XAML 不为覆盖率硬测。细则见 `unit-test-init/references/csharp.md` 与 `unit-test-generator/references/csharp.md`。
- 验证：沿用 solution/csproj 的 `dotnet test/build` 与既有 Windows runner；需要人工 UI 检查时写明确步骤和结果，不伪装自动化通过。
