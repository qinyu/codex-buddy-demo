# iOS

检测信号：`*.xcodeproj`、`*.xcworkspace`、`Package.swift`、`Podfile`、`.swiftlint.yml`、`.swiftformat`。

常见命令：
- `swiftlint lint --quiet`
- `swiftformat --lint .`
- `swift test`
- `xcodebuild test ...`

建议：
- SwiftLint/SwiftFormat 可作为 `pre-commit` 候选。
- `xcodebuild test` 默认作为 `pre-push` 候选，需要用户确认 scheme、destination 和耗时。
- 缺少可执行测试命令时，标记需要人工确认或 `unit-test-init`。
