# Run mode

`$product:workflow` 开工前选定 **run mode**，写入 `.workflow-state.json` 的 `run_mode`。单点阶段命令（如直接 `$product:prd`）在写本阶段产物前同样先钉档。

| 值 | 做什么 | 完成标准 |
|---|---|---|
| `stage-gated` | 做完**当前一阶段**产物后停下，等人批准再进下一阶段 | 本阶段 md + state 已写；已问「是否进入下一阶段」 |
| `through-run` | 按顺序把**本切片范围内**各阶段产物写完 | 范围内每阶段都有文件；**PRD 和开发计划一定有** |
| `lite` | 一天内完成的单模块小改，只写短 PRD、短开发计划与开发证据 | 两道批准门：短 PRD 已批；`develop.md` 新鲜验证证据已批 |

## 开工钉档

`run_mode` 在本切片开工时定死：连跑在进第一阶段前，单点阶段命令在写本阶段产物前。确认后写入 `.workflow-state.json`，后续阶段只读 state，不重推、不静默换档。state 已有 `run_mode` 时直接沿用。

助手按本条需求复杂度给推荐并说明依据，用户一句话确认。用户可以强制：「走轻量」「走完整」或 `--mode=lite|full`，强制优先于推荐。未确认前不得按 lite 裁剪阶段。

对人只说「轻量」和「完整」。`stage-gated` / `through-run` 是完整档的内部节奏（一阶段一停还是连跑），不是第三种工作流。

## 怎么选

**完整 · through-run**：用户点名「一次跑完」「连跑」「全流程做完」「一口气做到开发」。

**轻量 · lite**：同时满足以下条件时给出推荐，用户一句话确认后采用。只看本条需求，不看项目是新是旧——`product_mode` 不参与 lite 判定：

- 只改一个按钮、字段、接口或业务规则。
- 影响范围不超过一个模块，预计一天内可完成。
- 不涉及新权限模型、敏感数据、schema/迁移、跨仓契约、架构边界或高风险发布。
- 相关代码位置和验证命令可通过轻量探查确认。

有任一条件不满足就不选 `lite`。用户未确认 lite 时仍用完整档。初始化配置 `workflow_policy.test_automation=required` 时，采用 lite 前还必须取得本次 `explicit_override`，写明原因、风险和回收点。

**完整 · stage-gated**：用户没点名 through-run，且未确认 lite。完整档的默认节奏。

**fog**（不确定高）时保持谨慎：缺目标用户或触发场景、问题表已有 blocker。此时不能选 lite；即使用户点了 through-run，也先问一个问题：继续 through-run，还是改 stage-gated。按回答执行。`product_mode` 为 unknown 不否决 lite；它的影响在澄清与 PRD 批准门（unknown 不得 Reviewed）。

## 中途改档

用户明说后才改 state：轻量改完整要补产物或把阶段标 `Not Applicable` 并写原因；完整改轻量按 lite 裁剪并逐项写原因。助手不得自己改档。

## lite 文件与两道门禁

lite 不引入新文件。切片只生成：

- `prd.md`：短版，必须有「范围 / 验收 / 验证 / 不做」。用户批准后才能实现。
- `development-plan.md`：短版，必须有 `TASK` 清单、文件范围和验证命令；它是已批 PRD 的执行拆解，不单独请求批准。
- `develop.md`：修改文件、验证证据、结果、风险与回滚。新鲜验证证据由用户批准后才完成切片。核对批准指向的验证证据；历史批准不覆盖后续新跑出的证据。
- `.workflow-state.json`：状态唯一源头，`run_mode` 为 `lite`。

`clarify`、`project-wiki`、两种原型、`test-cases`、`test-automation`、`technical-solution`、`start-implement` 在 state 中标 `Not Applicable` 并逐项写原因，不生成同名空壳文件。`test-automation` 的裁剪原因还要写进短 `prd.md`；配置要求自动化测试时必须同时记录 `explicit_override`。

lite 的开发计划状态由 AI 写 `Draft`，不伪造 `Reviewed`；PRD 批准后可直接按短计划执行。实现后运行：

```bash
node product-workflow-suite/product-workflow/scripts/validate_lite_slice.mjs <工作流目录>
node product-workflow-suite/product-workflow/scripts/render_review_board.mjs <工作流目录>
```

校验失败、验证未执行或失败时，不得把 `develop` 标为 `Reviewed`，也不得宣称切片完成。

## 完整档可裁剪

完整档按顺序走必做：澄清（若需要）、PRD、计划、开工、开发。切片级 Project Wiki 仍按配置：`required` 才生成，否则复用或标不适用。

其余阶段先套尺子，再决定写不写文件。标 `Not Applicable` 必须在 state 写原因，不造空壳。through-run 也遵守。用户点名该阶段则做，尺子让位。

| 阶段 | 自己标不适用 | 要写 |
|---|---|---|
| 原型 / Stitch | 无 UI、无用户旅程 | 有界面且用户要看交互；或点名 `$product:prototype` / Stitch |
| 技术方案 | 无新模块、无新接口、无权限或数据边界变化；或已有可用方案只引用 | 有新模块、新接口、权限或数据边界变化 |
| 测试用例 | 无新的可观察行为（只改文案/标签/已有字段，现有用例或自动化已覆盖）；或已有可用用例只引用。原因写「回归即可」 | 有新 AC、新分支、新权限或数据边界 |
| 自动化计划 | 无新自动化范围；与用例同一把尺子 | 有新的 UI/API/数据/权限自动化范围 |

有界面但用户没点名原型：问一句要不要做。无界面：不问，直接标不适用。

开工硬卡认带原因的 `Not Applicable`。缺文件且不是不适用则停。

三种 mode 都遵守单一源头：只改阶段源头文件和 state，看板由生成器派生。
