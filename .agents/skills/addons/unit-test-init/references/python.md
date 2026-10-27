# Python: Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when the project is identified as Python.
Follow every step in order.

---

## What you're installing

| Package | Purpose |
|---|---|
| `pytest` | Test runner |
| `pytest-cov` | Coverage plugin for pytest, wraps `coverage.py` |
| `junitparser` | (optional) Validates junit.xml — skip unless debugging |

The combination of `pytest` + `pytest-cov` produces both required output files in a
single test run.

---

## Step 1: Install dependencies

Determine whether the project uses a virtual environment, Poetry, or bare pip, then
install accordingly.

**pip / venv (most common):**
```bash
pip install pytest pytest-cov
```

**Poetry:**
```bash
poetry add --group dev pytest pytest-cov
```

**pip with `pyproject.toml` (PEP 517/518):**
Add to `[project.optional-dependencies]` or `[tool.pytest.ini_options]` as appropriate,
then run `pip install -e ".[dev]"`.

If a `requirements-dev.txt` or `requirements-test.txt` already exists, append the
packages there so they're tracked in version control:
```
pytest>=7.0
pytest-cov>=4.0
```

---

## Step 2: Configure pytest

Create or update `pytest.ini` (or the `[tool.pytest.ini_options]` section in
`pyproject.toml`) with the following settings. Adjust `--cov=.` to match the
actual path of the source code you want to measure (e.g. `--cov=src` or `--cov=app`),
but `. ` (current directory) is generally safe for full repository coverage:

**`pytest.ini`:**
```ini
[pytest]
addopts =
    --cov=.
    --cov-report=xml:reports/coverage.xml
    --junit-xml=junit.xml
    --cov-report=term-missing
testpaths = tests
```

**`pyproject.toml`:**
```toml
[tool.pytest.ini_options]
addopts = [
    "--cov=.",
    "--cov-report=xml:reports/coverage.xml",
    "--junit-xml=junit.xml",
    "--cov-report=term-missing"
]
testpaths = ["tests"]
```

**`pyproject.toml` equivalent:**
```toml
[tool.pytest.ini_options]
addopts = [
    "--cov=src",
    "--cov-report=xml:reports/coverage.xml",
    "--cov-report=term-missing",
    "-v",
]
testpaths = ["tests"]
```

The `--cov-report=xml:reports/coverage.xml` flag writes Cobertura-format XML to
`reports/coverage.xml`. This is the file coverage tools and CI jobs typically read.

---

## Step 3: Configure JUnit XML output

pytest does not produce JUnit XML by default. Add the `--junit-xml` flag to `addopts`:

```ini
addopts =
    --cov=src
    --cov-report=xml:reports/coverage.xml
    --cov-report=term-missing
    --junit-xml=junit.xml
    -v
```

This writes `junit.xml` to the project root.

---

## Step 4: Verify

Run the test suite:
```bash
pytest
```

Confirm both files exist and are non-empty:
```bash
ls -lh junit.xml coverage.xml
```

Expected output: two files, each at least a few hundred bytes. If either is missing,
check that `addopts` is being picked up (run `pytest --co -q` to see the effective
configuration).

---

## Output file locations

| File | Default path |
|---|---|
| `junit.xml` | `./junit.xml` |
| `coverage.xml` | `./reports/coverage.xml` |

## .gitignore additions

```
junit.xml
reports/
```

---

## Coverage XML Readiness Check

Run the following verification after configuration:

```bash
pytest
ls -lh reports/coverage.xml  # should exist and be non-empty
```

If `reports/coverage.xml` is missing, check whether `pytest.ini` or
`pyproject.toml` includes `--cov-report=xml:reports/coverage.xml` in `addopts`.

---

## Coverage exclusions

Reserve exclusion placeholders in `.coveragerc` or `pyproject.toml` during
initialization:

```ini
# .coveragerc
[report]
omit =
    # Add file-level exclusions here, for example:
    # */generated/*
    # */migrations/*
```

**Line-level exclusions (the finest granularity Python supports):**

```python
def legacy_process(self):  # pragma: no cover
    old_algorithm()

def new_feature(self):
    result = compute()
    legacy_call()      # pragma: no cover  # only this line
    return result
```

> The exact exclusion rules should be decided later by `unit-test-generator`
> after the testability assessment.
---

## Step 4: Output the initialization script (do not execute it automatically)

The bash block below is the command sequence. Wrap it per `references/windows-scripts.md` (Windows native → `init_test_env.ps1`, otherwise `init_test_env.sh`).
Do not execute it automatically: `pytest` may trigger test discovery, fixture
initialization, and other work with unpredictable runtime in restricted
environments.

```bash
#!/usr/bin/env bash
# init_test_env.sh - Python unit test environment setup and coverage reporting
# Usage: bash init_test_env.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pre-flight dependency checks to fail early
check_deps() {
    set +e
    local missing=()
    command -v python3 >/dev/null 2>&1 || missing+=("python3")
    command -v pytest  >/dev/null 2>&1 || missing+=("pytest (pip install pytest pytest-cov)")
    python3 -c "import pytest_cov" 2>/dev/null  || missing+=("pytest-cov (pip install pytest-cov)")
    set -e
    if [ ${#missing[@]} -ne 0 ]; then
        echo "Missing dependencies. Install them before retrying:"
        for dep in "${missing[@]}"; do echo "   - $dep"; done
        exit 1
    fi
}

run_tests() {
    mkdir -p reports
    # Replace --cov=. with a narrower package path such as --cov=src if needed
    pytest \
        --junitxml=reports/junit.xml \
        --cov=. \
        --cov-report=xml:reports/coverage.xml \
        --cov-report=term-missing \
        "$@"
}

verify_outputs() {
    echo ""
    echo "Finished. Generated artifacts:"
    ls -lh reports/junit.xml reports/coverage.xml 2>/dev/null || echo "Reports were not generated. Inspect the logs above."
}

main() {
    check_deps
    run_tests
    verify_outputs
}
main "$@"
```

After generating the script, tell the user:
```
init_test_env.sh has been generated. Run it manually:
    bash init_test_env.sh
After it finishes, `reports/coverage.xml` will be available for the local
coverage threshold gate.
```
