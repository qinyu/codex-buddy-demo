# Unit Test Generator: Core Testing Principles

> This file is referenced by `unit-test-generator/SKILL.md`. It defines the
> shared testing standards that apply across all supported languages.

## Core principles

Apply these rules whenever you generate, repair, or refactor tests.

### 1. FIRST

Every unit test must be:

- **Fast**: finish in milliseconds. Do not use `sleep()`, real network traffic,
  or heavy disk I/O.
- **Independent**: tests must not depend on execution order or shared mutable
  state.
- **Repeatable**: the result must be stable across runs. Isolate time, random
  values, and environment-dependent behavior.
- **Self-validating**: the test must fail or pass through assertions. Never
  rely on manual log inspection.
- **Timely**: tests should be added alongside production changes, ideally with
  a TDD mindset.

### 2. Coverage strategy

Do not chase line coverage mechanically. Design meaningful cases:

- **Equivalence partitioning**: cover both valid and invalid input classes.
- **Boundary value analysis**: target edge conditions such as empty arrays,
  `0`, `MAX_INT`, and over-limit strings.
- **Triangulation**: for more complex logic, use multiple examples that verify
  the same rule from different angles.
- **Error paths**: cover exceptions, timeout paths, null-like inputs, and
  explicit failure branches.

### 3. Choose the right test double

Use the narrowest double that matches the problem:

- **Dummy**: placeholder input that is never exercised.
- **Stub**: fixed return value used to drive a branch.
- **Spy**: records calls so the test can verify side effects.
- **Mock**: carries strict expectations that must be satisfied.
- **Fake**: lightweight working implementation, often the best option for
  complex external systems such as databases or file systems.

## Naming and structure

### Naming

Prefer the naming style that fits the target ecosystem:

- **Java / Swift / TypeScript**: camelCase, for example
  `shouldReturnZeroIfInputIsEmpty`.
- **Python**: snake_case, for example
  `test_should_return_zero_if_input_is_empty`.
- **Kotlin**: idiomatic Kotlin test names are acceptable, including backtick
  names where the framework supports them.
- **JavaScript**: sentence-style names inside `test()` are acceptable.
- **Flutter / Dart**: sentence-style names inside `test()` are acceptable.

Regardless of case style, the name must describe observable behavior plus the
triggering condition. Names like `testFoo()` or `test_calculate()` are not
acceptable.

### AAA structure

Every test body must contain explicit AAA markers:

```text
// Arrange
// Act
// Assert
```

- `Arrange`: build inputs, subject instances, and doubles.
- `Act`: perform the single action under test.
- `Assert`: verify the observable outcome.

Do not omit these markers. They improve readability and review speed.

### Required scenario coverage

| Scenario type | What to cover |
|---|---|
| Positive | Expected inputs and expected outputs |
| Boundary | Empty values, null-like values, zero, min/max, and edge cases |
| Exception | Invalid input, missing dependencies, explicit error states, thrown exceptions |

### Parameterized or table-driven tests

When multiple inputs share the same assertion pattern, use the target
framework's built-in parameterization or table-driven mechanism instead of
copy-pasting separate tests.

Read the language-specific reference file for exact syntax.

## Isolation rules

### What may be mocked

Only mock external boundaries:

- Databases and repositories
- Network calls such as HTTP, gRPC, or WebSocket
- Hardware interfaces
- File-system I/O
- Time providers
- Random generators

### What must not be mocked

Do not mock:

- Value objects, DTOs, plain data structures, or enums
- The unit under test itself
- Pure functions without side effects
- Standard library helpers such as string formatting, math, or sorting

The framework does not matter. Whether the API is `unittest.mock`, `Mockito`,
`MockK`, or `jest.fn()`, keep the same boundary: mock the seam to the outside
world, not your own domain logic.

## Prohibited patterns

| Anti-pattern | Why it is banned |
|---|---|
| Order-dependent tests | Tests must run in any order |
| `assertTrue(true)` or equivalent | It proves nothing |
| `if` / `else` / `for` in test bodies | It hides intent and adds logic bugs to the test itself |
| One test covering multiple unrelated behaviors | Failures become hard to localize |
| Assertions against private state or private methods | Tests should verify observable behavior |
| Testing the mock framework instead of the code | A mock returning exactly what you configured is not a business assertion |
| Changing production visibility only for tests | Refactor for testability instead of adding backdoors |

## Performance and teardown

Fast and isolated tests are mandatory:

- Each test must be independent.
- Release every acquired resource in teardown or the framework equivalent.
- Do not mutate global state without restoring it.
- If a unit test takes more than a few hundred milliseconds, treat that as a
  design smell and inspect the dependency boundary.
