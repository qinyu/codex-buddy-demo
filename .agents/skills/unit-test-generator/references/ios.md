# iOS and Swift Unit Testing Generator Reference

## Framework

- Use **XCTest** with `import XCTest`.
- Prefer protocol-oriented manual doubles over heavy third-party mocking
  libraries.

## AAA structure example

```swift
final class CalculatorTests: XCTestCase {
    func test_sum_withEmptyInput_shouldReturnZero() {
        // Arrange
        let calc = Calculator()
        let input: [Int] = []

        // Act
        let result = calc.sum(input)

        // Assert
        XCTAssertEqual(result, 0)
    }
}
```

## Parameterized tests

XCTest does not provide native parameterized tests. Use a list of cases inside a
single test function.

```swift
func test_sum_withVariousInputs_shouldReturnCorrectSum() {
    // Arrange
    let testCases: [(input: [Int], expected: Int)] = [
        ([], 0),
        ([1, 2, 3], 6)
    ]

    for (input, expected) in testCases {
        // Act
        let calc = Calculator()
        let result = calc.sum(input)

        // Assert
        XCTAssertEqual(result, expected, "Failed for input: \(input)")
    }
}
```

## Async code

- Required: use `async/await`.
- Banned: `sleep()` and `Thread.sleep()`.

```swift
func test_fetchData_shouldReturnSuccess() async throws {
    // Arrange
    let service = MockNetworkService()

    // Act
    let result = try await service.fetchData()

    // Assert
    XCTAssertTrue(result)
}
```

## Coverage XML readiness check

Before generating tests, confirm that the coverage pipeline is already in place:

```bash
ls .slather.yml 2>/dev/null || echo "MISSING"
command -v slather >/dev/null 2>&1 || bundle exec slather --version 2>/dev/null || echo "SLATHER_MISSING"
ls reports/cobertura.xml reports/coverage.xml 2>/dev/null || echo "XML_MISSING"
```

## Minimal fix when readiness is missing

If the project only needs a lightweight repair:

```yaml
coverage_service: cobertura_xml
xcodeproj: YourApp.xcodeproj
scheme: YourAppScheme
output_directory: ./reports
ignore:
  - "Pods/*"
```

```bash
gem install slather
# or
bundle install
bundle exec slather
```

## Coverage exclusions

### When to use the exclude path

Offer Option B when the pre-check finds:

- high-risk legacy files with no existing test protection
- generated code such as Protobuf output or Core Data models

### Important Swift limitation

Swift coverage tooling does not support line-level or method-level ignore
annotations. Exclusions must happen at the file or directory level through
`.slather.yml`.

### Recommended workarounds

1. Move legacy-only methods into a dedicated extension file such as
   `TypeName+Legacy.swift`, then ignore that file.
2. Split legacy code into a standalone file and ignore the file.
3. If the code cannot be split safely, discuss a temporary policy exception with
   the team and document the reason in the PR.

### File-level exclusion

```yaml
ignore:
  - "Sources/Legacy/*"
  - "Sources/Payment/LegacyPaymentHelper.swift"
  - "Sources/*/+Legacy.swift"
```

Document the exclusion reason in the PR description and route follow-up cleanup
to a tracked follow-up item.
