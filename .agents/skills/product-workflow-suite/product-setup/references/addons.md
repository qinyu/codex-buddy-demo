# 外挂索引

默认安装只含入口和常规阶段 skill。外挂缺了，主流程仍跑；命中才读对应页。未命中不提示安装。

Setup（`$product:setup`）读本页，按表探测。阶段 skill 只跟指针，不复制外挂实现。

Limix 门户不是外挂 skill，命令在 `portal.md`。

## 工作流和外挂怎么互找

外挂不在 `product-workflow-suite/` 里。门户各装各的，落到客户端 skills 根下的独立目录（`.cursor|.codex|.claude|.agents/skills/<name>/`）。

- **探测**：看本机有没有对应 `SKILL.md`。code-wiki 还认图和清单，见 `detect_code_wiki.mjs`。
- **请对方做事**：用 skill 名（`$wiki`、`$unit-test-init`、`$unit-test-generator`、`$git-hook-init`、`$product:stitch-prototype`、`$secidea-scan-gate`）。Stitch 触发串仍是 `$product:stitch-prototype`，目录名是 `stitch-prototype`。
- **不要**写 `skills/<外挂>/...`，也不要写同仓相对路径：外挂与主套件分开安装。
- **代码查询**：交给Wiki选择已就绪的运行时；缺环境或依赖退回已安装CodeGraph或授权源码，不借普通查询安装。只有图、没装Wiki：报告可选增强缺失，继续获准材料。
- **跑主套件脚本**：从 `product-workflow` skill 目录取，例如 `scripts/detect_code_wiki.mjs`。Wiki不要假设自己和product-workflow同仓。
- **读产物按路径，不按安装位置**：仓库导航 `docs/repo-wiki/`；跨仓地图切片 `project-wiki.md` 或 `docs/project-wiki/`；图 `.codegraph/codegraph.db`。

| 外挂 | 类 | 探测 | 挂在 | 细则 |
|---|---|---|---|---|
| impeccable | 第三方，本仓零源码 | `detect_design_context.mjs` | init、首次 wiki、原型、develop | `addons/impeccable.md` |
| Stitch | 与 impeccable 对等：本仓不维护 MCP/SDK | 本机有 `stitch-prototype` skill，或用户点名 Stitch 路线 | 原型 | `addons/stitch.md` |
| 单元测试 | 可外挂，本仓可另发 | 本机有 `unit-test-init` / `unit-test-generator` | 技术方案缺口、kickoff 建议、develop 新增代码 | `addons/unit-test.md` |
| Git Hook | 可外挂，本仓可另发 | 本机有 `git-hook-init` | 技术方案缺口、kickoff 建议、develop 改质量命令 | `addons/git-hook.md` |
| wiki | 可外挂，独立分包 | `detect_code_wiki.mjs` | 基础任务只需Wiki skill；query_ready仅门控代码图查询 | `addons/wiki.md` |
| 安全扫描 | 可外挂，独立分包 | 本机有 `secidea-scan-gate` skill，或已有 `.secidea/secidea.json` | develop 写完、提 MR 前 | `addons/security.md` |

完成标准：每个外挂要么「未命中 → 跳过并写原因」，要么「命中 → 只读对应页」。不要在本文件展开命令。
