# Hook Patterns

| 检测信号 | Stage | 命令模式 | 风险 | 验证 |
|---|---|---|---|---|
| ESLint/Prettier | `pre-commit` | `eslint {staged_files}` / `prettier --check` | 避免全量格式化 | `lefthook run pre-commit` |
| commitlint | `commit-msg` | `commitlint --edit` | shell 参数引用 | 临时 commit message 文件 |
| Gradle/Maven | `pre-push` | `./gradlew test` / `./mvnw test` | 耗时，需确认 | 手动运行同命令 |
| 单元测试通过率 | `pre-push` | 项目已有测试命令，例如 `npm test` / `pytest` / `mvn test` | 耗时，报告缺失 | 先手动运行同命令 |
| 覆盖率阈值 | `pre-push` | 团队确认的 `test:coverage` / `jacoco:check` / `koverVerify` / `--cov-fail-under` | 阈值来源不明 | 命令低于阈值时必须非零退出 |
| Android ktlint/detekt | `pre-commit` 或 `pre-push` | `./gradlew ktlintCheck detekt` | 多模块路径 | `root` 限定目录 |
| SwiftLint | `pre-commit` | `swiftlint lint --quiet` | 本机工具缺失 | `swiftlint version` |
| xcodebuild test | `pre-push` | wrapper script | 耗时和模拟器依赖 | 用户确认后启用 |
| secret / large file | `pre-commit` | existing scanner or custom handler | 不读取 secret 内容 | scanner dry run |
