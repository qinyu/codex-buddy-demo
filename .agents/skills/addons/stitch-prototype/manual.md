# Stitch 原型与设计流指南 ($product:stitch-prototype)

`product-workflow-0.9.3`

当团队采用 Stitch 作为设计与原型方案时，本技能用于调度 Stitch 原型运行器，生成结构化的原型记录与设计元数据。

---

## 一、解决什么问题

在具备特定设计集成环境或使用 Stitch 流水线的项目中：
- 需要将产品需求与 Stitch 自动化设计系统对接；
- 沉淀具备设计令牌（Design Tokens）与规范约束的设计记录；
- 记录原型生成过程中的上下文、组件映射与设计偏差。

---

## 二、怎么对助手开口

在需要接入 Stitch 原型流程时，显式指定指令：

```text
$product:stitch-prototype 请根据已批准的需求文档生成 Stitch 原型记录。
```

或者使用自然口语说明：

```text
本次需求的原型走 Stitch 路线，帮我生成对应的设计产物。
```

---

## 三、与 HTML 原型路线的区别

- **[标准 HTML 原型](product-prototype.html)**：产出单文件离线可运行的 `prototype.html`，适合大多数 Web 与系统界面的轻量快速体验；
- **Stitch 原型 (`$product:stitch-prototype`)**：依赖 Stitch runner 环境，产出 `stitch-prototype.md` 记录。若在无 Stitch 环境的项目中，系统会明确提示降级回退到标准 HTML 原型。
- **纯后端或无 UI 需求**：两条路线均会自动裁量跳过，并在状态机中记录 `Not Applicable`。

---

## 四、关键产物：`stitch-prototype.md`

产物存放在需求切片目录下：`docs/product-development/YYYY-MM-DD-<需求名称>/stitch-prototype.md`。

记录包含组件层级映射、设计上下文消费依据、异常回退建议与人工审阅确认状态。
