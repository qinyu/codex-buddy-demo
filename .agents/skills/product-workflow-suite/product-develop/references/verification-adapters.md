# 本地验证适配

用于已有、已批准的测试命令。测试生成后仍按阶段约定由用户运行；本适配器不放宽该边界，也不负责安装测试基建。

输入是实现名、工作区、显式测试文件。当前两种实现：Node 内置 test runner 与 Python unittest。只替换实现名/文件入口，不改任务、规则、批准和结果合同。

```sh
node <product-develop>/scripts/run_verification.mjs node-test <工作区> test/options.test.mjs
node <product-develop>/scripts/run_verification.mjs python-unittest <工作区> test_options.py
```

结果：`capability=verification`、`implementation`、`command[]`、`exitCode`、`stdout`、`stderr`、`tests`、`skipped`、`status`、`reason`、`approved=false`。保存原始 JSON 到本轮证据目录，引用实际路径。运行失败、超时、缺实现或没有实际执行测试都为 `incomplete`。`passed` 只表示进程及测试报告通过，不替代业务断言质量审查、人工批准或收工条件。

项目已有其他验证命令时继续按计划运行并保留原始回执，不强制改框架。可选能力缺失时回到既有验证，尚未运行不标通过；必需验证缺失即未完成，豁免只记录建议。不自动安装依赖，不用模拟扫描结果替代真实验证。
