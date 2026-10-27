---
name: product-ask
description: 现在该用哪条产品工作流。只指路，不代为连跑。
disable-model-invocation: true
---

# 现在用哪条

人触发。只告诉人点哪条 `$product:*`。等人点名再停。

## 主线

setup → clarify → wiki → prd → review → 原型 → 用例 / 自动化计划 → 技术方案 → plan → review → kickoff → develop → wrap-up。完整档尺子见 `run-mode.md`：无界面不做原型，无新模块/接口不做技术方案，无新可观察行为不写用例。点名才做。绑了门户时开工硬卡后自动同步一次。

## 怎么选

| 情况 | 请用户执行 |
|---|---|
| 空目录，还没有项目代码 | `$product:setup`（询问是否接入材料，允许只准备章程） |
| 已有仓，第一次配工作流 | `$product:setup` |
| 一天内单模块小改 | 确认 lite 后 `$product:prd`（短 PRD 过 `$product:review`），再 `$product:develop`（短计划可并进 develop） |
| 要一次做完整切片 | `$product:workflow <需求>` |
| 停在某一阶段 | 点该阶段：`$product:prd` / `$product:plan` / `$product:kickoff` 等 |
| PRD 或计划已是 Draft，要请人批 | `$product:review` |
| 写完要收尾 | `$product:wrap-up` |

多条都像时列出候选和推荐，等人点名再停。
