# Go Unit Testing Generator Reference

## Framework

- Use Go's standard `testing` package by default.
- Use `httptest`, `context`, `testing/fstest`, and `t.TempDir()` from the
  standard library before introducing third-party test helpers.
- If the project already uses `testify`, `gomock`, or another stack, follow the
  existing style.

## File and package placement

- Put tests in `*_test.go` files next to the production code.
- Use the same package for white-box tests that need unexported helpers.
- Use `<package>_test` only when testing the public API from the outside.

## AAA structure example

```go
func TestCalculatorSumReturnsZeroForEmptyInput(t *testing.T) {
	// Arrange
	calc := Calculator{}
	input := []int{}

	// Act
	got := calc.Sum(input)

	// Assert
	if got != 0 {
		t.Fatalf("expected 0, got %d", got)
	}
}
```

## Table-driven tests

```go
func TestCalculatorSum(t *testing.T) {
	tests := []struct {
		name  string
		input []int
		want  int
	}{
		{name: "empty", input: []int{}, want: 0},
		{name: "positive numbers", input: []int{1, 2, 3}, want: 6},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			calc := Calculator{}

			// Act
			got := calc.Sum(tt.input)

			// Assert
			if got != tt.want {
				t.Fatalf("expected %d, got %d", tt.want, got)
			}
		})
	}
}
```

## Async, IO, and HTTP

- Do not use `time.Sleep` as a synchronization mechanism. Use channels,
  contexts with deadlines, fake clocks, or injected interfaces.
- Use `httptest.NewServer` or `httptest.NewRecorder` for HTTP handlers and
  clients.
- Use `t.TempDir()` for filesystem tests.
- Inject interfaces for network, database, clock, and random sources.

## Coverage XML readiness check

```bash
test -s junit.xml || echo "JUNIT_MISSING"
test -s reports/coverage.xml || echo "XML_MISSING"
```

If these files are missing, do not invent a custom report format. Route the
project to `unit-test-init` so it can configure `go-junit-report` and
`gocover-cobertura`.

## Coverage exclusions

Go does not have a standard line-level coverage exclusion pragma. Prefer
extracting pure helpers and testing them. If a file is generated or framework
entrypoint code is not testable in this PR, document the exemption in
`docs/testing/coverage-exemptions.md` and configure the existing coverage
aggregation tool to exclude it if the project already has one.
