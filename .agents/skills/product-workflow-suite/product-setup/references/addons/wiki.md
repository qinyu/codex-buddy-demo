# 可选 Wiki

通过Skill调用 `wiki`，传 `task`、`workspace`、`targets`、`read_scope.docs/source`、`write_scope`、`graph_ops`及各项已有用户授权依据。已有入口作为targets，未知填unknown；空范围表示未授权，工作区位置不是全仓内容许可。query/build/sync按仓库分别传递用户选择，安装另行授权。Wiki独立分包；基础文档整理无Python或CodeGraph要求。未安装时最小Setup继续，所选Wiki任务报告缺依赖，不自动安装。

代码分析是Wiki内部可选分支。detect_code_wiki.mjs只读探测其图查询条件；query_ready=true可尝试，运行结果才证明成功。未命中或not_applicable时按授权材料继续，不提示强制安装、不建空图；user_declined时不读源码或图。

可选执行器模式（实验）仅由调用方/用户明确选定，不作为基础运行时默认。选定后本次取证的业务 read/search/图 query 经 `wiki/scripts/authorized-operations.mjs` 执行，请求文件写在已授权 scratch/报告路径，不写进工作区；授权来自用户真实任务，unknown 保留 unknown，不扩 workspace、不加邻页、不读夹具。未选定时保持自然语言路径。

已有图与内部CLI可用时使用search/cite/impact；MCP和shell均允许。安装、建图、LSP、密钥与章程修改各自需要明确授权，不默认onboard --yes-install。知识页面实际完成才记完成；失败保留具体缺口与恢复入口。
