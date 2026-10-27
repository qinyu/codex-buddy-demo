---
name: product-review
description: >-
  对抗审查。prd.md 或 development-plan.md 已是 Draft 时，过规格 / 可判定 / 事实。用户点名 product:review、对抗审查时使用。
---

# Product Review

## 命令

```text
$product:review
```

写完的人不能自己放行。清单在 `references/checklist.md`，本 skill 只定步骤。

Codex 桌面从技能列表启动时，这就是一次新会话：没有上一轮写稿记忆。先认切片、读文件，本会话自己审。不要再派一层 reviewer。

## 何时

- `$product:prd` 把 `prd.md` 写成 `Draft` 之后、请求人批之前。lite 短 PRD 同样过。
- `$product:plan` 把 `development-plan.md` 写成 `Draft` 之后。full 请人批之前过；lite 计划不单独请批，过不了不得进入实现。

其他阶段本版不做。

## 公共契约

执行本 skill 时必须遵守 `../product-workflow/references/common-contracts.md`，尤其是认切片。独立启动时没有会话记忆，必须先认切片再读写。

## 步骤

1. 认切片：用户给的路径 → 当前目录自己就是切片 → `docs/product-development/` 下恰好一个 → 否则列出路径问人。找不到就停，不要空转，不要用最近日期猜。
2. 钉死源头：切片里已是 `Draft` 的 `prd.md` 或 `development-plan.md`。两份都是 Draft 时问人审哪份。读那份全文、直接上游（审 PRD 读澄清；审计划读已批 PRD）、`references/checklist.md`。
3. 本会话按清单审。只有「同一会话刚写完这份稿」才另开 fresh reviewer，且必须把本阶段全文、直接上游、清单贴进提示词。桌面从技能列表启动、或派了却收不到任务：本会话自己审，不要空等。
4. 先过人机两句，再填三轴。每条发现写：轴、原文位置、问题、建议。
5. 完成标准以清单为准。有阻断：保持 `Draft`，先改或问。无阻断：仍是 `Draft`，等人批才写 `Reviewed`。
6. 改过源头则跑 `render_review_board.mjs`。`portal_sync=bound_project` 时只调用 `portalHandoff`，记下未同步，不因对抗审查结束自动上传。

## 完成

源头已有 `## 对抗审查`；阻断时未请人按已通过批准。
