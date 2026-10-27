# Go: Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when a project contains
`go.mod` or `go.work`.

## What you're configuring

Go has a built-in test runner and built-in coverage profile support, but it does
not produce JUnit XML or Cobertura XML directly. Use small converter tools:

| Tool | Purpose |
|---|---|
| `go test` | Runs tests and writes `reports/coverage.out` |
| `go-junit-report` | Converts `go test -json` output to `junit.xml` |
| `gocover-cobertura` | Converts Go coverage profile to `reports/coverage.xml` |

## Step 1: Install report converters

Prefer a project-local tool bootstrap script instead of assuming the binaries are
already installed globally:

```bash
go install github.com/jstemmer/go-junit-report/v2@latest
go install github.com/boumenot/gocover-cobertura@latest
```

If the customer network blocks module downloads, keep these lines in
`init_test_env.sh` and ask the user to run them in their approved Go proxy
environment.

## Step 2: Create `init_test_env.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports
export PATH="$(go env GOPATH)/bin:${PATH}"

if ! command -v go-junit-report >/dev/null 2>&1; then
  go install github.com/jstemmer/go-junit-report/v2@latest
fi

if ! command -v gocover-cobertura >/dev/null 2>&1; then
  go install github.com/boumenot/gocover-cobertura@latest
fi

go test ./... -covermode=count -coverprofile=reports/coverage.out -json \
  | tee reports/go-test.json \
  | go-junit-report -parser gojson > junit.xml

gocover-cobertura < reports/coverage.out > reports/coverage.xml

test -s junit.xml
test -s reports/coverage.xml
```

## Step 3: Add a Makefile target if the project already uses Make

```makefile
.PHONY: test coverage

test:
	go test ./...

coverage:
	bash init_test_env.sh
```

Use `make coverage` or `bash init_test_env.sh` as the `pre-push` gate command
after the user confirms it succeeds locally.

## Output file locations

| File | Default path |
|---|---|
| `junit.xml` | `./junit.xml` |
| `coverage.xml` | `./reports/coverage.xml` |
| `coverage.out` | `./reports/coverage.out` |
| `go-test.json` | `./reports/go-test.json` |

## .gitignore additions

```
junit.xml
reports/
```

## Common issues

- **`go-junit-report: command not found`** — run the `go install` line or ensure
  `$GOPATH/bin` is on `PATH`.
- **`gocover-cobertura: command not found`** — run the `go install` line or use
  the customer-approved binary mirror.
- **`reports/coverage.out: no such file`** — ensure the `go test` command
  includes `-coverprofile=reports/coverage.out` and the package list is not
  empty.
- **No tests in a package** — `go test ./...` can still pass; coverage will be
  low. Route missing meaningful tests to `unit-test-generator`.
