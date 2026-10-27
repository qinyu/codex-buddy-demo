# Merge Strategy

## Lefthook

解析 `lefthook.yml` 或 `.lefthook.yml` 后合并 hook stage 和 command key。保留用户已有命令。新增命令使用稳定 key，例如 `frontend-lint`、`backend-check`、`android-lint`、`ios-lint`。

## package.json

只更新必要字段，不重排无关字段。`simple-git-hooks` 和 `lint-staged` 必须 merge，不删除旧 entry。

## pre-commit

保留已有 repos，只追加缺失 local hooks。不得把 pre-commit 项目迁移到 Lefthook。

## Husky

不覆盖 `.husky/*`。如果要追加命令，输出 patch 并保留原脚本内容。
