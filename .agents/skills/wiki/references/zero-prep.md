# 零认知词表

仅在用户选择词表增强且许可探查源码时使用。若用户授权委派，可用独立fresh-context subagent；否则当前会话执行。只读已授权代码、注释、README、已有图谱。

产物：`docs/project-wiki/glossary/<alias>.json`（term、aliases、symbols、source_file）。符号须能在该仓图里搜到。进 git。

抽检：在仓内跑 `codegraph query <symbol> --json --limit 5`，命中须带图谱给的 path。提问、baseline、词表三条各自独立。
