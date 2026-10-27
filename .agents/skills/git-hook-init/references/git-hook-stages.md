# Git Hook Stages

| Stage | 适合任务 | 不适合任务 |
|---|---|---|
| `pre-commit` | staged file lint/format、轻量静态检查、secret/large file | 全量测试、耗时构建 |
| `commit-msg` | commit message 规范 | 代码质量检查 |
| `pre-push` | 单元测试通过率、覆盖率阈值、较重集成检查、移动端构建前检查 | 每次提交都必须立即完成的格式化 |
| `post-merge` | 依赖提示、环境提示 | 阻塞质量门禁 |

默认把快速、局部、确定性的检查放入 `pre-commit`。把单元测试、覆盖率阈值、Android/iOS 构建、模拟器相关检查放入 `pre-push` 候选，并要求用户确认。
