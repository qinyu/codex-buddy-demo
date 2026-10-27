# 引擎门禁（第一轮 skill eval 之外）

替身数字见咨询仓 `方法专项/知识库-智库/评测工作区/`。引用时标注实测。客户仓复测后再当承诺。

下表是**旧引擎 code-review-graph 的实测记录**，保留作历史对照，不要当成当前引擎的数字。

| 门禁 | 口径（旧引擎 CRG，历史） |
|---|---|
| 单标识符 MRR | crg 官方 eval，替身 7/7 = 1.0 |
| 业务题 | 词表 + 本地嵌入后 11/12（92%）；原句直查 0/12 |
| 建库 | crg 约 33s / 增量约 0.26s；graphify `--code-only` 约 131s（4400 文件，实测） |
| 查询 | crg 约 0.2s；graphify 约 2.6s（加载 graph.json） |

## CodeGraph 已实测（2026-09-20，1.6.0，darwin-arm64）

只在一个 1 文件 5 节点的最小 TS 替身仓上跑过——**数字不代表大仓**，只作冒烟基线。

| 项 | 实测 |
|---|---|
| 建库 | `codegraph init` 一次过；5 nodes / 7 edges，引擎报 303ms，含启动墙钟 1.05s |
| 查询 | `codegraph query --json` 墙钟 0.43s |
| 本机缓存 | `.codegraph/` 只有 `codegraph.db`（SQLite + WAL）与它自带的 `.gitignore` |
| 大仓表现 | **未测**；不外推到客户仓 |

### JSON 形状（已实测，锁在 `tests/test_codegraph_shape.py`）

```text
query   --json → 裸数组：[{node: {name, qualifiedName, filePath, startLine, endLine, kind}, score}]
impact  --json → {symbol, depth, nodeCount, edgeCount, affected: [{name, kind, filePath, startLine}]}
callers --json → {symbol, callers: [{name, kind, filePath, startLine}]}
```

要点：字段**嵌在 `node` 里**且为 camelCase。解析器先 `unwrap` 再取名，扁平 snake_case 仍兼容。

### 两个实测踩到的坑

1. **cwd 决定查哪个库**：`codegraph` 按当前目录找 `.codegraph/`，没有 `--repo` 参数。
   查询必须在仓内执行。曾经因为 `_run` 不收 `cwd` 而被兼容回退静默吃掉，报错是
   「CodeGraph not initialized in <进程当前目录>」。已修并加回归测试。
2. **安装走 npm，别走 curl**：`install.sh` 拉 GitHub release 的 54MB 包，国内直连
   均速 ~245KB/s 且反复断流（卡在 36MB 不动）。`npm i -g @colbymchenry/codegraph`
   走 npm 源，3 秒装完（平台二进制是 optional dep）。Windows 同理优先 npm。
3. **vendored deps 不被自动排除**：Redis 实测，`deps/jemalloc/src/jemalloc.c` 进了图。
   它默认排除的是名为 `vendor` 的目录，不是任意 `deps/`。项目若有自备的
   第三方目录，需在项目根的 `codegraph.json` 里写 `exclude` 明确排除。

业务题：提问、baseline、词表三条各自独立；命中须能打开图返回的 path:line。

## CodeGraph 多语言替身仓实测（2026-09-20，1.6.0，darwin-arm64）

全部在 **/tmp 临时目录**里跑，不碰任何主仓。仓库：TS 用我们自己的 `Limix/packages/gateway-core`
（拷到临时目录，含 node_modules 排除）；Java 用开源 `macrozheng/mall`（浅克隆）。

| 仓库 | 语言 | 索引文件 | 节点 | 边 | 引擎耗时 | 含启动墙钟 | DB |
|---|---|---|---|---|---|---|---|
| gateway-core | TypeScript | 3,831 | 61,970 | 331,779 | 5.8s | 19.09s | 368MB |
| mall | Java | 651 | 23,501 | 48,370 | 688ms | 3.09s | 51MB |
| jellyfin | C# | 2,242 | 39,389 | 91,496 | 3.3s | 7.75s | 128MB |
| redis | C | 897 | 20,013 | 76,728 | 3.0s | 7.30s | 63MB |
| jellyfin-web | 前端 | 881 | 12,906 | 30,117 | 751ms | 2.61s | 37MB |

查询耗时（各 3 次均值）：TS 0.31s；Java 0.26s。

语言覆盖（`codegraph status`）：
- gateway-core：typescript 3,560 / liquid 192 / javascript 50 / yaml 21 / python 7 / objc 1
- mall：java 524 / xml 114 / yaml 12 / properties 1
- jellyfin：csharp 2,214 / yaml 16 / xml 12
- redis：c 772 / python 48 / cpp 24 / yaml 23 / lua 20 / ruby 9
- jellyfin-web：typescript 317 / tsx 289 / javascript 254 / yaml 14

正确性抽查（真实符号 → 真实路径行号）：
- Java `query OmsOrderService` → 接口 `.../OmsOrderService.java:13` + 实现类 `.../OmsOrderServiceImpl.java:24`
- Java `impact OmsOrderServiceImpl` → 29 节点 / 28 边，含 orderMapper、orderDao 等真实字段
- TS `query buildRequirement` → `src/services/__tests__/software-workflow.service.test.ts:35`
- C# `query UserManager` → `Jellyfin.Server.Implementations/Users/UserManager.cs:68`
- C# `impact UserManager` → **464 节点 / 543 边**，含 `_dbProvider`、`_eventManager` 等真实字段
- redis `query serverCron` → `src/server.c:1575`；deps/ 的 jemalloc.c 也进图（见坑 3）
- jellyfin-web `impact useApi` → 396 节点 / 567 边，含 `useLogEntries`、`AppLayout` 等 4 个真实消费者

**边界**：五仓（TypeScript / Java / C# / C / 前端 JS+TS）只证「能建图、能回链到 path:line、多语言都通」；
不证万级以上文件的大仓表现。**XAML/WPF 未测，且已明确不支持**——
jellyfin 是 C# 服务端，不含 WPF；上次那档用的 Flow Launcher（WPF）本次未跑（见下方 WPF 实测段）。
客户真实仓仍需单独复测。

## WPF 替身实测：丢 XAML 到底丢多少（2026-09-20，Flow Launcher）

上次那批替身仓的 WPF 档是 **Flow-Launcher/Flow.Launcher**（WPF 客户端）。
本轮把它跑了一遍，量化「清除 graphify/XAML 分支」的实际代价。

| 项 | 数值 |
|---|---|
| 盘上 `.cs` | 388 文件 / 64,403 行 |
| 盘上 `.xaml` | **393 文件 / 55,080 行（行数占 46.1%）** |
| 图里 indexed files | 408（csharp 388 / yaml 14 / xml 4 / python 2） |
| **未覆盖的 `.xaml`** | **393 个；文件占 50.3%，代码行占 46.1%** |
| 建图 | 9,433 节点 / 19,409 边，引擎 600ms，含启动 1.89s，DB 22MB |

### 决定性取证（同一样本文件的两个符号）

样本：`Plugins/Flow.Launcher.Plugin.Program/ProgramSuffixes.xaml`（含 17 个 `{Binding ...}`）

| 查什么 | 结果 |
|---|---|
| `query BtnCancel_OnClick`（XAML 里 `Click="..."` 指向的处理器，定义在 `.cs`） | **10 命中** —— 实现侧有覆盖 |
| `query RelativeSource`（绑定相关） | **0 命中** |
| 图里 `filePath` 以 `.xaml` 结尾的节点 | **0** |

### 结论：丢的是「界面层与它的接线」，不是逻辑

保留：ViewModel、服务层、code-behind 的方法体 —— 业务逻辑都在 `.cs` 里。
丢失：

1. 393 个 `.xaml` 全部不进图
2. **绑定边**：`{Binding X}` → ViewModel 属性
3. **事件接线边**：`Click="BtnCancel_OnClick"` 这条「按钮 → 处理器」的边。
   处理器本身在图里，**从 XAML 到它的那条边没了**
4. 资源、样式、模板、页面导航结构

问「这个方法怎么算」→ 够用。问「这个按钮点了走哪条链路」「改这个 View 会影响什么」→ **断链**。

C#/WPF 项目现场同样适用：**若业务链路要从界面入口起追，XAML 缺失会成为硬断点**。
建议在真实仓复测时先确认「业务锚点是否从界面起」；若是，需另找补 XAML 的方案。
