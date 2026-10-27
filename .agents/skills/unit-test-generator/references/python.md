# Python Unit Testing Generator Reference

## Framework

- Use **pytest** as the default test runner and test framework.

## AAA structure example

```python
def test_should_return_zero_if_input_is_empty():
    # Arrange
    calculator = Calculator()
    input_data = []

    # Act
    result = calculator.sum(input_data)

    # Assert
    assert result == 0
```

## Parameterized tests

Use `@pytest.mark.parametrize` when multiple inputs share the same verification
logic.

```python
import pytest


@pytest.mark.parametrize("input_val,expected", [
    ([], 0),
    ([1, 2, 3], 6),
])
def test_should_return_correct_sum_for_various_inputs(input_val, expected):
    # Arrange
    calculator = Calculator()

    # Act
    result = calculator.sum(input_val)

    # Assert
    assert result == expected
```

## Coverage XML readiness check

Before generating tests, confirm that coverage output is already configured:

```bash
python3 -c "import pytest_cov" 2>/dev/null || echo "MISSING"
grep -q "cov-report=xml" pytest.ini pyproject.toml setup.cfg 2>/dev/null || echo "XML_DISABLED"
ls coverage.xml reports/coverage.xml 2>/dev/null || echo "XML_MISSING"
```

## Minimal fix when readiness is missing

If the project only needs a light repair and does not require a full
`unit-test-init` pass:

```bash
pip install pytest-cov
```

Append this to `pytest.ini`:

```ini
[pytest]
addopts = --cov=. --cov-report=xml:reports/coverage.xml
```

## Coverage exclusions

### When to use the exclude path

Offer Option B when the pre-check finds:

- high-risk legacy code with no existing tests
- configuration or scaffolding code with no meaningful business logic

### Line-level exclusions

Python supports fine-grained exclusion with `pragma: no cover`:

```python
def legacy_process(self):  # pragma: no cover
    old_algorithm()
    deprecated_call()


def new_feature(self):
    result = compute()
    legacy_call()  # pragma: no cover
    return result


def handle(self, mode):
    if mode == "legacy":  # pragma: no cover
        self._old_path()
    return self._new_path()
```

### File-level fallback

```ini
# .coveragerc
[report]
omit =
    */legacy/*
    */generated/*
```

Document the exclusion reason in the PR description and route broader cleanup to
a tracked follow-up item.
