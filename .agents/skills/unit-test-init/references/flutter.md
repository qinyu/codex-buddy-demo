# Flutter / Dart: Unit Test Infrastructure Setup

This file is loaded by `unit-test-init` when the project is identified as Flutter
or Dart (indicated by `pubspec.yaml`). Follow every step in order.

---

## What you're installing

Flutter's test runner (`flutter test`) produces LCOV coverage data. Two external
tools convert its output into common JUnit XML and Cobertura XML artifacts.

| Tool | Purpose |
|---|---|
| `junitreport` (Dart pub global) | Converts `flutter test --machine` output to JUnit XML |
| `lcov_cobertura` (Python) | Converts LCOV coverage data to Cobertura XML |

---

## Prerequisites

Confirm the following are available before proceeding:

```bash
flutter --version   # Flutter SDK
dart --version      # Dart SDK (bundled with Flutter)
python3 --version   # Python 3.x for lcov_cobertura
```

If Python is missing, install it via the system package manager or `brew install python3`.

---

## Step 1: Install `junitreport`

`junitreport` is a Dart pub global package that reads Flutter's machine-readable
test output and writes JUnit XML.

```bash
dart pub global activate junitreport
```

Confirm it's on `PATH`:
```bash
which junitreport
```

If the shell can't find it, add the Dart pub cache bin directory to `PATH`:
```bash
export PATH="$PATH:$HOME/.pub-cache/bin"
```

Add that export to `.bashrc`, `.zshrc`, or the project's `.envrc` so it persists.

---

## Step 2: Install `lcov_cobertura`

```bash
pip install lcov_cobertura
```

Confirm it's available:
```bash
python3 -c "import lcov_cobertura; print('ok')"
```

---

## Step 3: Run tests and produce output files

Flutter's pipeline chains two commands. Run them together:

```bash
# Run tests with machine output and coverage, pipe to junitreport
flutter test --machine --coverage 2>&1 | tee flutter_test_output.json | junitreport > junit.xml

# Convert LCOV coverage to Cobertura XML
mkdir -p reports
python3 -m lcov_cobertura coverage/lcov.info --output reports/coverage.xml
```

Breaking this down:

- `flutter test --machine` — runs all tests and writes machine-readable JSON to
  stdout. `--coverage` generates `coverage/lcov.info`.
- `| tee flutter_test_output.json` — saves the raw output for debugging (optional
  but useful). Remove `tee flutter_test_output.json |` if you don't need it.
- `| junitreport > junit.xml` — converts the machine output to JUnit XML.
- `python3 -m lcov_cobertura coverage/lcov.info --output coverage.xml` — converts
  the LCOV file to Cobertura XML.

---

## Step 4: Add a Makefile target (recommended)

```makefile
.PHONY: test
test:
	flutter test --machine --coverage 2>&1 | junitreport > junit.xml
	mkdir -p reports
	python3 -m lcov_cobertura coverage/lcov.info --output reports/coverage.xml
```

Now `make test` runs the full pipeline.

---

## Step 5: Verify

```bash
make test   # or run the pipeline directly
ls -lh junit.xml coverage.xml coverage/lcov.info
```

Both `junit.xml` and `coverage.xml` should be present and non-empty.
`coverage/lcov.info` is an intermediate file.

---

## Troubleshooting

**`junitreport` not found after install:**
Run `dart pub global list` to confirm it's installed, then check that
`$HOME/.pub-cache/bin` is on `PATH`.

**`coverage/lcov.info` is empty or missing:**
Flutter only generates coverage for files that are imported by at least one test.
If no tests exist yet, create a placeholder test file that imports the main library:
```dart
// test/placeholder_test.dart
import 'package:your_package/your_package.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('placeholder', () => expect(true, isTrue));
}
```

**`lcov_cobertura` import error:**
Try `pip3 install lcov_cobertura` or install inside a virtual environment.

---

## Output file locations

| File | Default path |
|---|---|
| `junit.xml` | `./junit.xml` |
| `coverage.xml` | `./reports/coverage.xml` |
| LCOV data | `./coverage/lcov.info` (intermediate) |

---

## .gitignore additions

```
coverage/
junit.xml
reports/
flutter_test_output.json
```

---

## Coverage XML Readiness Check

Run the following verification after configuration:

```bash
flutter test --coverage
mkdir -p reports
python3 -m lcov_cobertura coverage/lcov.info --output reports/coverage.xml
ls -lh reports/coverage.xml  # should exist and be non-empty
```

---

## Coverage exclusions

Reserve exclusion placeholders during initialization. Flutter and LCOV support
line-level ignore annotations:

**Line-level or block-level exclusions (the finest granularity Flutter supports):**

```dart
void legacyProcess() {
  // coverage:ignore-start
  oldCode();
  deprecatedCall();
  // coverage:ignore-end
}

void newFeature() {
  final x = legacyInit(); // coverage:ignore-line
  return compute(x);      // counted normally
}
```

**File-level fallback:**

Add `--excludes` to the `lcov_cobertura` command:

```bash
mkdir -p reports
lcov_cobertura coverage/lcov.info \
  --excludes ".*generated.*" \
  -o reports/coverage.xml
```

> The exact exclusion rules should be decided later by `unit-test-generator`
> after the testability assessment.
