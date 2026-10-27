# Shared Checks

通用检查：
- commit message: commitlint 或团队等价规范
- secret: existing scanner 或项目已有脚本
- large file: 项目已有脚本或 Git provider 限制
- lock file: 不直接编辑，除非由包管理器产生
- unit test pass: 使用项目已有测试命令，失败即阻断
- coverage threshold: 使用团队确认的覆盖率阈值命令，不默认生成统一增量覆盖率工具

安全要求：
- 不读取 secret 文件内容。
- 不自动编辑 `.git/`。
- 不把推断命令写成已确认命令。
- 不替团队发明覆盖率阈值；未知时标记待确认。

失败路由：
- 测试基建或报告缺失：转 `unit-test-init`。
- 测试失败或覆盖率不足：转 `unit-test-generator` 补测试或修测试。
