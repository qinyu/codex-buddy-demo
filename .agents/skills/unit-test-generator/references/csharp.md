# C# / WPF：生成单测事例

目标文件是 `.cs` 或相关 `.xaml` 对应的代码时加载本文件。框架跟 csproj 里已有的走（xUnit / NUnit / MSTest），不要换成事例里的包。

## 结构

每个测试用 Arrange / Act / Assert。先读现有测试风格再写。

xUnit 事例：

```csharp
[Fact]
public void 空列表求和应为零()
{
    // Arrange
    var calc = new Calculator();
    var input = Array.Empty<int>();

    // Act
    var result = calc.Sum(input);

    // Assert
    Assert.Equal(0, result);
}
```

参数化事例（仅当项目已在用 Theory）：

```csharp
[Theory]
[InlineData(1, 2, 3)]
public void 两数相加(int a, int b, int expected)
{
    Assert.Equal(expected, a + b);
}
```

## WPF

- 测 ViewModel 的属性和命令、值转换器、纯逻辑。
- 不要为了覆盖率去测 code-behind 里的界面事件，或打开真实 Window。
- 已有组件和工具类直接复用，不要另起一套。
- 字段和绑定路径必须能在现有类型或表结构里找到。
