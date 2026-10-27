# 开工检查与执行方式建议（待批准）

## 决策摘要

已批准的 PRD、技术方案与开发计划均在本地提交 `e913865`，当前 HEAD 等于 `origin/recording/20261028063907-full`，工作区干净。当前分支名为 `recording/20261028044146-stage-0`，但其 HEAD 跟踪的上游是用户指定的开发分支 `origin/recording/20261028063907-full`；未在 `main/master` 上，未 push 的提交数为 0。门户同步关闭。

**已批准执行方式：multi-subagent，严格串行派发。** 用户于 2026-10-28 已明确批准此开工检查与方式，并要求保持当前检出。 本切片有多个任务、跨 bridge/adapter/固件、共享文件重叠且含权限门禁；串行所有权比 single 更利于逐任务隔离实现和 review。替代方式 `single` 会减少上下文切换，但需要一个执行者连续持有并审查所有共享接口和固件联动。多 subagent 不得并行写同一工作树；一个实现任务完成并经规格/质量 review 后才能派发下一个。

即使后续批准执行方式，DSH 相关实现仍不启动：接缝核验未解除前，不得实现、安装、启用 DSH adapter 或改用户 DSH profile。现有授权允许先做计划中非 DSH 任务，但不代表接受 AC-008 失败或取消 DSH 范围。

## 开工门禁核对

| 检查项 | 本轮事实 | 结论 |
|---|---|---|
| 完整档审批状态 | PRD、prototype、test-cases、test-automation、technical-solution、development-plan 均在 `.workflow-state.json` 标 `Reviewed`；project-wiki 为带原因 `Not Applicable`；clarify 已 Reviewed | 通过；state validator 通过 |
| 已批准源头本地提交 | 对 PRD、原型、测试用例、自动化计划、技术方案、开发计划、澄清稿逐项检查；均由 `e913865 docs: record approved multi-agent stick workflow` 引入，工作树无这些文件改动 | 通过 |
| 本地提交/分支 | `HEAD=e913865a7ae91d27937eef83053f2b45ae011195`；`origin/recording/20261028063907-full` 同一 SHA，ahead/behind `0/0`；当前 branch 名称是 stage-0 branch，但 upstream 指向指定 full branch | 通过，提醒当前检出名称与目标分支名称不同；执行前确认继续留在此工作区/分支，不擅自切换分支 |
| 用户工作区改动 | 当前 `git status --short` 干净；忽略文件 `.review-board/` 是生成产物 | 通过；不纳入实现 |
| Wiki / 代码图 | 已读 repo Wiki index、architecture、development；`detect_code_wiki.mjs` 返回 `query_ready=false`、`graph_ready=false`，不尝试 CodeGraph；关键事实由源码/测试/配置回查 | 通过；Wiki 是导航，未覆盖完整调用图 |
| 单测基建与 Git Hook | 已有 Python unittest 文件；无根级统一 runner/report 配置、无自定义 Git Hook、无 `core.hooksPath`；开发计划含 TASK-000 评估 | 非硬挡；TASK-000 未完成，不视为测试或 Hook 已通过，不做豁免 |
| 自动化测试任务映射 | AUTO-TASK-001..007 映射到 TASK-001..006 与 TASK-DSH-VERIFY；真实设备只在单独授权后，DSH adapter 未排期 | 通过；DSH 阻断保持 |
| 设备操作/用户配置 | 本次未授权设备连接、BLE 配对、刷写、串口脚本或助手用户配置修改 | 未执行；TASK-006 的设备部分需另行明确授权 |
| 门户 | `portal_sync=off` | 跳过；未调 Limix、未写门户状态 |

## 关键前置与执行限制

1. `$product:develop` 开始后仍先执行 TASK-000 的测试 runner/report 与 hook 现状评估，不得安装或升级依赖、改 hook manager 或添加 CI，除非另有批准。TASK-000 不挡业务代码，但未完成时相关测试/报告仍标未完成。
2. TASK-001/002/003 会共享 bridge Hub、packet 或测试数据；执行时按开发计划顺序串行，不并行修改。TASK-004 冻结 packet 尺寸/字段后再进固件 TASK-005。
3. TASK-DSH-VERIFY 只允许按另行授权的只读/隔离证据流程确认真实支持 API、profile mount、生命周期及端到端事件；用户本轮明确说未验证且相关实现任务不要启动，因此现在保持 `BLOCKED`，不运行插件、不改 profile，也不启动 adapter 实现。
4. stick 的 BLE/按键/刷写测试需设备授权，未授权前只允许离线测试和不接设备的编译（若工具可用且开发计划批准）。
5. 如果源码或隔离测试发现批准规格、权限边界、任务范围/验证命令需变更，暂停受影响任务并回到对应阶段，不以实现自行改写批准事实。

## 仍未能确认的执行问题

- 当前检出分支名不是 `recording/20261028063907-full`，但 HEAD 与该远端 ref 完全相同且上游已指向它；执行方式批准后应继续留在该 checkout，还是用户要求显式切换到同名本地分支？这不改变文件与 HEAD 证据，但会影响后续 Git 操作归属。建议保持现状，避免不必要切换。
- DSH 接缝验证需要产品/DSH 技术责任人提供受支持 API 与隔离 profile 的实际事件证据；用户明确要求验证前不启动相关实现，故接入任务保持停止。
- 设备最终验收需要 Stick 操作授权；不阻断纯离线开发，但阻断相关硬件 AC 的验收与切片完成声明。

执行方式批准记录：用户于 2026-10-28 批准 `multi-subagent` 串行执行并要求保持当前检出。下一步为 `$product:develop --mode=multi-subagent`；开始实现前仍须满足 Reviewed 源头本地提交门禁。DSH 暂停和设备操作边界继续有效。
