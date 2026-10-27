# cite 与 impact

`--kind cite`：旧实现 `repo` + `path:line`，调用方能打开该行。符号名或点名文件直接 cite。列名 cite entity、mapper 或 DDL；都没有则记 gap。

`--kind impact`：在获准范围内核对调用方、测试引用、同仓import。跨仓许可明确时分仓查，再用获准Project Wiki / OpenAPI对齐接口。

`user_declined`：只答获准wiki/词表；不查源码或代码图。无仓时列出缺口，询问用户提供仓库或材料，不自动运行ensure。
