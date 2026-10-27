# 项目画像

## 已确认事实

- 项目：Codex Buddy，为 M5Stack StickS3 / ESP32-S3 提供桌面伴侣；包含固件、Codex 插件、本地 Python BLE bridge 和角色动画资源。来源：`README.md`、`platformio.ini`、`plugins/codex-usage-stick/README.md`。
- 用户已选择完整产品工作流配置，允许源码探查，门户同步关闭。
- 测试自动化为必需；每次开工检查单测基建；原型路线自动选择。
- 用户选择项目模式按证据推断；本次确认当前需求按现有产品增量演进（`one_to_n`）。
- 复用基础 Wiki：`docs/repo-wiki/index.md`；CodeGraph 已就绪，`.codegraph/` 为本地派生数据。

## 配置选择与依据

- `domain_role=未确认`：用户明确要求暂不指定领域角色。
- `product_mode=one_to_n`、`mode_detection=explicit`：用户于 2026-10-28 明确确认当前需求按现有产品增量演进。
- `test_automation=required`、`unit_test_infra_check=required`：用户明确选择。
- `prototype_route=auto`：用户明确选择；届时按需求是否涉及可视交互及现有项目材料决定。
- `project_wiki=optional`、`repo_wiki=prefer_existing_or_generate_missing`：已创建基础仓库 Wiki，后续按需复用或补充；未选择强制维护独立项目 Wiki。
- `code_exploration=required`：用户允许只读探查源码；这不授权未经单独批准的构建、测试、安装、刷写、部署或设备操作。
- `portal_sync=off`：用户明确要求关闭；不得调用 Limix 或创建门户同步状态文件。
- `config_strength=strong_with_explicit_override`：明确选择按配置执行；用户后续明确覆盖时按其新指示更新。
- `clarification_style=single_question`：采用当前套件允许的逐项澄清方式。

## 范围与边界

- 仓库：`https://github.com/qinyu/codex-buddy-demo.git`，本地工作区根目录。
- 已有代码和基础 Wiki 均可复用。已知主硬件目标为 StickS3 / ESP32-S3，PlatformIO 另列 `m5stickc-plus` 环境。
- 本轮没有运行构建或测试，也没有连接设备、改 Codex 设置或安装依赖。
- 2026-10-28 刷新工作流配置：项目根目录确认为当前仓库目录 `.../full/code`；刷新时 HEAD 为 `f0310834aad84c55bbe3ab38a3ed5e2e1e8d7461`，工作区干净。此次只修正配置路径与 freshness，不改变已选策略。
- 项目模式由用户确认为 `one_to_n`；README 中“working prototype”仅作现状描述，不作为模式判断依据。
- README、`docs/USAGE.md` 与插件元数据中有仓库地址、作者等信息不一致，权威归属待项目维护者确认。

## 资料入口

- 项目介绍与约束：`README.md`、`REFERENCE.md`、`docs/USAGE.md`
- 基础知识导航：`docs/repo-wiki/index.md`
- CodeGraph：`.codegraph/`（本地忽略，不提交）
- 当前工作流策略：`.product-workflow-config.json`
