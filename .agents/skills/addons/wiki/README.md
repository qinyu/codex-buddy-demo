# Wiki

一个skill处理基础知识创建、查询与增量更新。用户可点名Wiki，Setup与Wrap-up也可调用。步骤见 [SKILL.md](SKILL.md)。

基础文档整理不需要Python、CodeGraph或Git；先复用已有文档。CodeGraph与LLM模块梳理是按需增强，分别需要任务授权；安装、建图和重建不是普通查询的副作用。

内部Python包仍叫 `code-wiki`，代码在 `src/code_wiki/`，并非另一个skill入口。仅在选用代码增强且已有环境/依赖就绪时使用；环境缺失则退回已安装CodeGraph或获准源码，不为普通查询安装：

```sh
uv run --no-sync --directory <wiki-skill-dir> code-wiki query --repo <repo> --question <question> --kind search
```

CLI必须显式写子命令：裸 `code-wiki` 只显示帮助；`code-wiki <路径>` 和未知子命令报错，不再自动进入ensure。确需历史准备流程时使用 `code-wiki ensure <路径>`，并先取得其副作用所需授权；普通查询仍使用上面的query入口。

调用方传递目标、文档/源码读取范围、写入范围和图操作，具体语义见SKILL第1节。这是执行约定，不是文件系统权限隔离。当前DeepSeek定向评测仍出现范围外读取及访问报告遗漏，不能把该skill作为敏感资料的安全隔离措施；字段完整、页面写对、测试通过均不证明读取合规。

模块页沿用docs/project-wiki/wiki/，仓库导航沿用docs/repo-wiki/；已有资料不搬迁、不复制。派生索引和缓存不提交Git。

开发验证：`uv run pytest`。旧ensure/onboard/SSH/LSP CLI保留内部实现与测试，不是推荐的默认知识流程；材料接入与章程定稿归Setup。
