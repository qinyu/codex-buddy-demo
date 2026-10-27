# 完整工作流配置

仅用户选择完整模式时使用。profile记录项目范围、来源、策略理由、用户选择与未知项，路径为docs/product-workflow/project-profile.md。分析/草稿不以缺配置阻断；正式执行按有效批准门禁。

## 输出：.product-workflow-config.json

写入或修订 `.product-workflow-config.json`，schema version 为 `1`。必须是有效 JSON。

推荐结构：

```json
{
  "schema_version": 1,
  "project_root": "/absolute/project/root",
  "profile_path": "docs/product-workflow/project-profile.md",
  "freshness": {
    "generated_at": "2026-07-05T00:00:00Z",
    "git_commit": "commit-sha-or-non-git"
  },
  "workflow_policy": {
    "config_strength": "strong_with_explicit_override",
    "domain_role": "财务系统专家",
    "product_mode": "unknown",
    "clarification_style": "single_question",
    "mode_detection": "inferred_unconfirmed",
    "project_wiki": "optional",
    "repo_wiki": "prefer_existing_or_generate_missing",
    "code_exploration": "required",
    "prototype_route": "auto",
    "test_automation": "required",
    "unit_test_infra_check": "required",
    "portal_sync": "off"
  },
  "stage_defaults": {
    "clarify": {
      "must_read_config": true
    },
    "project_wiki": {
      "default": "optional"
    },
    "test_automation": {
      "default": "required_if_implementation"
    }
  },
  "open_questions": []
}
```

允许值：

- `workflow_policy.config_strength`: `strong_with_explicit_override`
- `workflow_policy.domain_role`: 字符串；用户未给出时写 `"未确认"`，不得编造领域
- `workflow_policy.product_mode`: `zero_to_one`、`one_to_n`、`unknown`
- `workflow_policy.clarification_style`: `single_question`
- `workflow_policy.mode_detection`: `explicit`、`inferred_confirmed`、`inferred_unconfirmed`
- `workflow_policy.project_wiki`: `required`、`optional`、`not_applicable`
- `workflow_policy.repo_wiki`: `prefer_existing_or_generate_missing`、`prefer_existing_only`、`not_applicable`
- `workflow_policy.code_exploration`: `required`、`allowed`、`user_declined`
- `workflow_policy.prototype_route`: `auto`、`html`、`stitch`、`not_applicable`
- `workflow_policy.test_automation`: `required`、`optional`、`not_applicable`
- `workflow_policy.unit_test_infra_check`: `required`、`optional`
- `workflow_policy.portal_sync`: `off`、`bound_project`。缺省视为 `off`。旧配置 `manual_only` 按 `off` 读。

如果某个策略会影响后续阶段但无法确认，先问缺失决定；可把建议与问题写进草稿profile，但不要将未确认值写入生效的workflow_policy。新配置只有已确认选择才落盘；已有配置保留原值等待裁决。domain_role未确认、product_mode=unknown仅是事实缺口，不授权推测test_automation/unit_test_infra_check等门禁。portal_sync未选择时默认off仅表示不连接门户，不表示用户已批准整份配置。


Wiki默认推荐而非默认required；用户明确选择后写入策略。拒绝生成写not_applicable并在profile记录用户拒绝的原因，不等同拒绝源码探查。旧required保留，变更需明确覆盖。
