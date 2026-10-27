# Wiki 的可选代码分析接入

通过Skill调用 `wiki`，由其选择基础查询或CodeGraph增强，不跨目录读取其参考实现。Wiki独立分包；基础模式不需要Python/图。未命中时按Wiki Context Gate使用授权材料，不报错、不提示强制安装、不建空图。

```bash
node <product-workflow>/scripts/detect_code_wiki.mjs <项目根>
```

探测保留字段：detected（发现配置/图/Wiki）、graph_ready（存在数据库）、query_ready（有Wiki、有图且政策允许尝试），以及skill_dir/skill_path。query_ready不是命令成功或索引新鲜度证明。新安装路径为客户端skills/wiki；原code-wiki不是保留的skill入口。

旧workflow_policy.code_wiki / code_wiki_provider字段继续读取；默认optional，not_applicable不启用增强，required缺依赖时报告受阻。code_exploration=user_declined时不查询图、不读源码。缺配置先遵守AGENTS与用户授权，不猜同意。

## 交接授权

调用wiki时显式传 `task`、`workspace`、`targets`、`read_scope.docs/source`、`write_scope`、`graph_ops`、`authorization_confirmed`。各范围附已有用户授权依据；workspace仅定位，不能作为全仓内容授权。unknown表示已知任务所需的路径等信息缺失；用户未授予某类操作时传空列表，不写unknown。历史政策及用户本次明确许可原样传递，Wiki负责检查缺口。

task按最终交付选择：只回答query，新页create，改已有页update；图查询另列graph_ops。workspace传调用上下文已给定的绝对工作区（如Setup登记或明确指定的任务工作目录），不要求用户在业务句子里重复路径。只有调用上下文也缺位置时才标unknown并补问；保留位置不扩大内容许可。read_scope.docs只管业务文档，适用AGENTS、已有策略配置和skill规则仍需读取；“不改章程”不等于禁读规则，也不授予写权限。

可选执行器模式仅由调用方/用户明确选定，基础运行时默认关闭。选定后本次取证的业务 read/search/图 query 交给 Wiki 的许可感知执行器，请求文件写在已授权 scratch/报告路径，不写进工作区；授权来自用户真实任务，unknown 保留 unknown，workspace不转成docs授权，目标文件边界保持不变。未选定时保持自然语言路径。

定点更新传目标页和已获准的实现证据；导航/跨页任务可传用户已授权的目录范围。图query/build/sync分开列仓库，安装仍单独获准。目标未定位时传unknown与获准定位范围，由Wiki先做文件名定位；候选仍有歧义才请用户裁决。调用方传图取证目的、仓库与query/build/sync许可，不将执行器底层op/arg白名单当用户契约；Wiki在已有query许可内选择命令，再生成本次操作请求。callers表示调用方，impact表示变更影响；这些技术选择由Wiki负责。

## 任务映射

| 阶段 | 给Wiki的任务 |
| --- | --- |
| Setup | 用户选择后create；增强另行选择，已有仓库不重新接入 |
| PRD / Wiki Context Gate | query，理解现有实现(search) |
| 技术方案 / kickoff | query，对齐旧实现(cite)与调用影响(impact) |
| develop | 改前cite，改后impact，按授权范围 |
| Wrap-up | update，只更新实际变化的长期知识 |
| lite | 读取已有资料，不强制建库 |

代码查询交给Wiki选择已就绪的MCP或shell，以真实结果而非声明作为证据。环境或依赖缺失时退回已安装CodeGraph或授权源码，不为普通查询创建环境、下载或安装依赖；说明未覆盖范围，不能把错误伪装成无命中。

用户选择建图/重建后，Wiki负责索引步骤及本地派生数据Git排除；安装需单独授权，不自动onboard/ensure，也不把LSP或SSH密钥变成Wiki必经步骤。内部旧CLI保留不是skill入口兼容。

已有docs/repo-wiki/、docs/project-wiki/、code-wiki-repos.json及深度活页继续复用；同主题不复制，图更新不自动改章程或重跑Setup。
