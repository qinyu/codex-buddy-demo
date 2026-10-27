# pre-commit

pre-commit 适合已有 `.pre-commit-config.yaml`、Python 工具链成熟、或明确需要社区 hook repository 的项目。它自身依赖 Python，首次运行可能初始化 hook 环境。MVP 不把它作为新多技术栈项目默认方案。

保守补齐原则：
- 保留已有 repos。
- 只追加缺失 local hooks。
- Gradle、Maven、SwiftLint、xcodebuild 这类项目命令使用 `language: system` 或等价 local hook。
