# 设计上下文接入

product-workflow 不打包 impeccable，也不要求客户安装。只有探测到既有采用证据时才接入：

```bash
node product-workflow-suite/product-workflow/scripts/detect_design_context.mjs <项目根目录>
```

命中条件（任一）：

- 项目根或用户目录存在 `.cursor/skills/impeccable/SKILL.md`、`.codex/skills/impeccable/SKILL.md`、`.claude/skills/impeccable/SKILL.md`、`.agents/skills/impeccable/SKILL.md`。
- 项目根已有 `PRODUCT.md` 或 `DESIGN.md`。

未命中时按现有工作流继续，不报错，不提示安装，不生成空的 `PRODUCT.md` / `DESIGN.md`。

## 阶段接入

| product-workflow 阶段 | impeccable 对应动作 | 约束 |
|---|---|---|
| `product-setup` | `init` | 生成/补全项目根 `PRODUCT.md`；已有内容只补缺，不覆盖。用户、任务、平台、约束以 `PRODUCT.md` 为源头，project-profile 只引用路径和摘要结论，不复制字段 |
| 首次 `wiki`（用户选择生成） | `document` | 项目有前端特征且缺 `DESIGN.md` 时生成；Project Wiki 只引用，不复制 token/组件规范 |
| `product-prototype` / `stitch-prototype` | 读取上下文 | 生成原型前必读 `DESIGN.md`；缺失则记录设计事实缺口，不能自创视觉体系 |
| `product-develop` | 读取上下文 | 前端实现前对照 `DESIGN.md`，记录复用 token、组件和偏差 |

`init` / `document` 指 impeccable skill 自己定义的对应命令或流程。product-workflow 只负责检测、路由和消费其产物，不复制对方实现。

## freshness

`PRODUCT.md` / `DESIGN.md` 生成或刷新时在 project-profile / Project Wiki 记录当时 `git rev-parse HEAD`。当前 HEAD 不同时只建议增量刷新；不得把“文件存在”当“内容一定新鲜”。用户未要求时不自动修复第三方产物。

## 原型与实现红线

- 没读现有 UI、`DESIGN.md`、token、组件或截图，不得自创风格。
- `DESIGN.md` 是设计事实源；PRD 只引用与本切片相关的约束，不复制整份设计系统。
- 现有实现与 `DESIGN.md` 冲突时先记录并请用户决策，不静默选择其中一个。
- 未命中 impeccable 时仍遵守“风格跟随现有系统”；找不到证据就明确标 gap，不能套通用后台模板。
