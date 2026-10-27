# Android

检测信号：`build.gradle`、`build.gradle.kts`、`settings.gradle*`、`gradlew`、`AndroidManifest.xml`。

常见命令：
- `./gradlew ktlintCheck`
- `./gradlew detekt`
- `./gradlew lintDebug`
- `./gradlew testDebugUnitTest`

建议：
- ktlint/detekt 可作为 `pre-commit` 或 `pre-push`，取决于耗时。
- unit test 默认作为 `pre-push` 候选。
- assemble 和 emulator test 不默认启用，必须用户确认。
