# Java

检测信号：`pom.xml`、`build.gradle`、`build.gradle.kts`、`mvnw`、`gradlew`。

常见命令：
- Maven: `./mvnw test`, `./mvnw checkstyle:check`, `./mvnw spotless:check`
- Gradle: `./gradlew test`, `./gradlew check`, `./gradlew spotlessCheck`

建议：
- 轻量格式或静态检查可作为 `pre-commit` 候选。
- 单元测试默认作为 `pre-push` 候选。
- 没有测试命令或报告产物时，标记需要 `unit-test-init`。
